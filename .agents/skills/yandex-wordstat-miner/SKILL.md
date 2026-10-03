---
name: yandex-wordstat-miner
description: |
  Automated semantic core expansion, frequency analysis, and search intent mining
  via Yandex Search API v2 (Wordstat in AI Studio) and Wordstat web engine.
  Extracts parent queries, nested phrases, associations, and device splits.
---

# Yandex Wordstat Miner (v2026.1)

## 1. Overview
Automates semantic keyword harvesting and intent clustering using the official **Yandex Search API v2 (Wordstat в AI Studio)**.

## 2. API v2 Endpoint & Schema
* **Endpoint**: `https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests`
* **Authentication**: `Authorization: Api-Key <YANDEX_AI_API_KEY>`
* **Folder Header**: `x-folder-id: <FOLDER_ID>`
* **Request Payload**:
  ```json
  {
    "phrase": "target query",
    "numPhrases": 50,
    "folderId": "b1g4u0ne53gg0mjtkebb"
  }
  ```
* **Response Payload**:
  * `totalCount`: Aggregate search frequency for the parent query
  * `results`: Array of `{ "phrase": string, "count": string }`
  * `associations`: Array of associative search phrases (right column in Wordstat)

## 3. Operator Hierarchy
* **Broad Match (`phrase`)**: Aggregate demand including all sub-queries and morphological variations.
* **Phrase Match (`"phrase"`)**: Demand restricted strictly to the words in quotes, ignoring extra tail words.
* **Exact Match (`"!phrase"` / `"[!word1 !word2]"`)**: Exact word forms and fixed word order.

## 4. Semantic Clustering Protocol
1. **Core Seed Generation**: Base roots (e.g. `smm панель`, `продвижение телеграм`, `просмотры рутуб`).
2. **Recursive Expansion**: Extracting top 10–50 subqueries per seed via `/v2/wordstat/topRequests`.
3. **Intent Segmentation**:
   * *Commercial Hot*: `купить`, `заказать`, `цена`, `тарифы`, `оптом`.
   * *Informational (Negative)*: `бесплатно`, `скачать`, `своими руками`, `слив`, `курс`.
   * *B2B / API*: `api`, `панель`, `реселлер`, `провайдер`, `сервис`.
   * *Competitor Conquest*: `smmprime`, `doctorsmm`, `smmlaba`, `lowcostsmm`.
