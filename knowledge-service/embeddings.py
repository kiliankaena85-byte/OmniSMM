import os
import logging
import numpy as np
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class BaseEmbedder(ABC):
    @abstractmethod
    def encode(self, text: str) -> np.ndarray:
        pass
    
    @abstractmethod
    def encode_batch(self, texts: list) -> np.ndarray:
        pass

class LocalEmbedder(BaseEmbedder):
    """Локальная модель — бесплатно, быстро, приватно"""
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
    
    def encode(self, text: str) -> np.ndarray:
        return self.model.encode(text, normalize_embeddings=True)
    
    def encode_batch(self, texts: list) -> np.ndarray:
        return self.model.encode(texts, normalize_embeddings=True, batch_size=32)

class OpenAIEmbedder(BaseEmbedder):
    """OpenAI API — лучшее качество, но платно"""
    def __init__(self, model: str = "text-embedding-3-small"):
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set but OpenAIEmbedder was requested.")
        
        # Configure custom proxy if provided (critical for some restricted regions)
        http_proxy = os.getenv("HTTP_PROXY")
        https_proxy = os.getenv("HTTPS_PROXY")
        
        if http_proxy or https_proxy:
            import httpx
            proxies = {}
            if http_proxy:
                proxies["http://"] = http_proxy
            if https_proxy:
                proxies["https://"] = https_proxy
            
            client_transport = httpx.HTTPTransport(proxy=proxies)
            http_client = httpx.Client(transport=client_transport)
            self.client = OpenAI(api_key=api_key, http_client=http_client)
        else:
            self.client = OpenAI(api_key=api_key)
            
        self.model = model
        self.dimension = 1536 if "small" in model else 3072
    
    def encode(self, text: str) -> np.ndarray:
        response = self.client.embeddings.create(input=text, model=self.model)
        return np.array(response.data[0].embedding)
    
    def encode_batch(self, texts: list) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dimension))
        response = self.client.embeddings.create(input=texts, model=self.model)
        return np.array([d.embedding for d in response.data])

def get_embedder() -> BaseEmbedder:
    provider = os.getenv("EMBEDDING_PROVIDER", "local").lower()
    if provider == "openai":
        try:
            return OpenAIEmbedder(os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"))
        except Exception as e:
            logger.error(f"Failed to initialize OpenAIEmbedder: {e}. Falling back to LocalEmbedder.")
    
    return LocalEmbedder(os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2"))
