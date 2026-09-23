import * as net from 'node:net';
import * as tls from 'node:tls';
import { SocksClient, SocksClientOptions } from 'socks';
import type { ProxyConfig } from '@/types/provider-proxy';

export interface ProxyHop {
  host: string;
  port: number;
  protocol: 'socks5' | 'http' | 'https';
  username?: string | null;
  password?: string | null;
}

export interface ChainedRoute {
  hop1: ProxyHop; // E.g. Quattro VPN entry gateway (Europe)
  hop2?: ProxyHop; // E.g. Free public exit node (USA/Global)
  targetHost: string;
  targetPort: number;
  useTls?: boolean;
}

export interface ChainedConnectionResult {
  socket: net.Socket | tls.TLSSocket;
  latencyMs: number;
  chainDescription: string;
}

export class ChainedProxyService {
  private static readonly SOCKET_TIMEOUT_MS = 3000;

  /**
   * Connects to a target destination through a 1-hop or 2-hop chained proxy.
   * Format: Local -> Hop 1 (Quattro SOCKS5) -> Hop 2 (Free SOCKS5/HTTP) -> Target
   */
  public static async createChainedConnection(route: ChainedRoute): Promise<ChainedConnectionResult> {
    const startTime = Date.now();

    // Case A: Direct single-hop (Hop 1 only)
    if (!route.hop2) {
      const socket = await this.connectSingleSocks5Hop(
        route.hop1,
        route.targetHost,
        route.targetPort
      );

      const finalSocket = route.useTls
        ? this.upgradeToTls(socket, route.targetHost, route.targetPort)
        : socket;

      const latencyMs = Date.now() - startTime;
      return {
        socket: finalSocket,
        latencyMs,
        chainDescription: `${route.hop1.host}:${route.hop1.port} -> ${route.targetHost}:${route.targetPort}`,
      };
    }

    // Case B: Two-hop Relay Chaining (Hop 1 -> Hop 2 -> Target)
    // 1. Connect through Hop 1 to reach Hop 2
    const intermediateSocket = await this.connectSingleSocks5Hop(
      route.hop1,
      route.hop2.host,
      route.hop2.port
    );

    // 2. Perform second SOCKS5 handshake over the established intermediate socket to reach target
    const finalRawSocket = await this.handshakeSocks5OverExistingSocket(
      intermediateSocket,
      route.hop2,
      route.targetHost,
      route.targetPort
    );

    const finalSocket = route.useTls
      ? this.upgradeToTls(finalRawSocket, route.targetHost, route.targetPort)
      : finalRawSocket;

    const latencyMs = Date.now() - startTime;
    return {
      socket: finalSocket,
      latencyMs,
      chainDescription: `${route.hop1.host}:${route.hop1.port} -> ${route.hop2.host}:${route.hop2.port} -> ${route.targetHost}:${route.targetPort}`,
    };
  }

  /**
   * Establishes SOCKS5 connection to a remote destination through a SOCKS5 proxy hop.
   */
  private static async connectSingleSocks5Hop(
    proxy: ProxyHop,
    destHost: string,
    destPort: number
  ): Promise<net.Socket> {
    const options: SocksClientOptions = {
      proxy: {
        host: proxy.host,
        port: proxy.port,
        type: 5,
        userId: proxy.username || undefined,
        password: proxy.password || undefined,
      },
      command: 'connect',
      destination: {
        host: destHost,
        port: destPort,
      },
      timeout: this.SOCKET_TIMEOUT_MS,
    };

    const info = await SocksClient.createConnection(options);
    return info.socket;
  }

  /**
   * SOCKS5 handshake over an already connected TCP socket (Tunnel-in-Tunnel).
   */
  private static async handshakeSocks5OverExistingSocket(
    existingSocket: net.Socket,
    proxyHop2: ProxyHop,
    destHost: string,
    destPort: number
  ): Promise<net.Socket> {
    const options: SocksClientOptions = {
      proxy: {
        host: proxyHop2.host,
        port: proxyHop2.port,
        type: 5,
        userId: proxyHop2.username || undefined,
        password: proxyHop2.password || undefined,
      },
      command: 'connect',
      destination: {
        host: destHost,
        port: destPort,
      },
      existing_socket: existingSocket,
      timeout: this.SOCKET_TIMEOUT_MS,
    };

    const info = await SocksClient.createConnection(options);
    return info.socket;
  }

  /**
   * Upgrades a raw TCP socket to TLS with strict certificate verification.
   */
  private static upgradeToTls(socket: net.Socket, servername: string, port: number): tls.TLSSocket {
    return tls.connect({
      socket,
      servername,
      rejectUnauthorized: true, // Strict Anti-MitM verification
    });
  }

  /**
   * Converts a ProxyConfig model to a ProxyHop.
   */
  public static toHop(config: ProxyConfig): ProxyHop {
    return {
      host: config.host,
      port: config.port,
      protocol: config.protocol as 'socks5' | 'http' | 'https',
      username: config.username,
      password: config.password,
    };
  }
}
