import asyncio
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

class LegalWarRoomOrchestrator:
    def __init__(self, db_client, llm_client, privacy_mode: bool = False):
        """
        Инициализация ядра оркестратора.
        :param db_client: Объект доступа к векторной БД (должен поддерживать метод search)
        :param llm_client: Клиент языковой модели (должен поддерживать response_format)
        :param privacy_mode: True для изоляции приватных локальных баз
        """
        self.db = db_client
        self.llm = llm_client
        self.privacy_mode = privacy_mode

    async def run_workflow(self, query: str, domain: str, event_date_str: str) -> Dict[str, Any]:
        """
        Главный жизненный цикл выполнения (State Machine).
        """
        try:
            event_date = datetime.strptime(event_date_str, "%Y-%m-%d")
        except ValueError:
            return {
                "status": "ERROR",
                "error_code": "INVALID_DATE_FORMAT",
                "message": "Дата должна быть представлена в формате ГГГГ-ММ-ДД."
            }

        # Шаг 1: Семантический поиск законов с жесткой фильтрацией по датам (Temporal Consistency)
        laws_context = await self._retrieve_laws(query, domain, event_date)
        if not laws_context:
            return {
                "status": "ERROR",
                "error_code": "NO_APPLICABLE_LAWS",
                "message": f"Не найдено применимых норм права на дату {event_date_str}."
            }

        # Шаг 2: Извлечение судебной практики (RAG по прецедентам)
        cases_context = await self._retrieve_cases(query, domain)

        # Шаг 3: Вызов Legis-Bot для структурирования применимых норм
        legis_result = await self._run_legis_bot(query, laws_context, event_date_str)
        if legis_result.get("status") == "NOT_FOUND":
            return {
                "status": "ERROR",
                "error_code": "LEGIS_NOT_FOUND",
                "message": "Legis-Bot не смог соотнести запрос с действующей базой законов."
            }

        # Шаг 4: Вызов Case-Bot для анализа судебной практики
        cases_analysis = await self._run_case_bot(query, cases_context)

        # Шаг 5: Разработка первичной стратегии (Strategist-Bot)
        strategy = await self._run_strategist(query, legis_result, cases_analysis)

        # Шаг 6: Цикл самопроверки и снижения рисков (Self-Correction Loop)
        max_attempts = 2
        risk_assessment = {}
        
        for attempt in range(max_attempts):
            risk_assessment = await self._run_risk_audit(strategy, legis_result)
            
            # Если обнаружен критический уровень риска (RED) в агрессивной тактике,
            # мы принудительно заставляем Strategist-Bot перестроить план
            if risk_assessment.get("overall_risk") == "RED" and attempt < max_attempts - 1:
                deescalation_context = json.dumps(risk_assessment.get("tactics_assessment", []))
                strategy = await self._run_strategist(
                    query, 
                    legis_result, 
                    cases_analysis, 
                    deescalation_trigger=deescalation_context
                )
            else:
                break

        # Шаг 7: Разработка сценария переговоров (Negotiator-Bot)
        negotiation_plan = None
        if self._requires_negotiation(query):
            negotiation_plan = await self._run_negotiator(query, legis_result)

        # Шаг 8: Архитектура документа (Draft-Bot)
        final_document = await self._run_draft_bot(strategy, legis_result, cases_analysis)

        # Шаг 9: Сборка итогового структурированного пакета для IDE
        return {
            "status": "SUCCESS",
            "meta": {
                "domain": domain,
                "event_date": event_date_str,
                "privacy_mode": self.privacy_mode
            },
            "legal_basis": legis_result,
            "case_comparison": cases_analysis,
            "tactics": strategy,
            "risk_analysis": risk_assessment,
            "negotiation_plan": negotiation_plan,
            "document": final_document
        }

    async def _retrieve_laws(self, query: str, domain: str, event_date: datetime) -> List[Dict[str, Any]]:
        """
        Программная фильтрация законов по метаданным времени действия (на стороне СУБД)
        """
        event_timestamp = int(event_date.timestamp())
        raw_laws = await self.db.search(
            collection_name="collection_law",
            query=query,
            filters={
                "must": [
                    {"key": "payload.domain", "match": {"value": domain}},
                    {"key": "payload.effective_from", "range": {"lte": event_timestamp}}
                ],
                "should": [
                    {"key": "payload.effective_to", "range": {"gte": event_timestamp}},
                    {"key": "payload.effective_to", "is_empty": True}
                ]
            }
        )
        return raw_laws

    async def _retrieve_cases(self, query: str, domain: str) -> List[Dict[str, Any]]:
        return await self.db.search(
            collection_name="collection_cases",
            query=query,
            filters={
                "must": [
                    {"key": "payload.domain", "match": {"value": domain}}
                ]
            }
        )

    async def _run_legis_bot(self, query: str, context: List[Dict], event_date_str: str) -> Dict[str, Any]:
        system_prompt = "Ты — Законодатель (Legis-Bot)..."
        response = await self.llm.generate(
            prompt=f"Запрос: {query}. Дата события: {event_date_str}",
            system_prompt=system_prompt,
            context={"laws_db_slice": context},
            response_format={"type": "json_object"}
        )
        return json.loads(response)

    async def _run_case_bot(self, query: str, context: List[Dict]) -> str:
        system_prompt = "Ты — Прецедент-аналитик (Case-Bot)..."
        return await self.llm.generate(
            prompt=query,
            system_prompt=system_prompt,
            context={"cases_db_slice": context}
        )

    async def _run_strategist(self, query: str, laws: Dict, cases_markdown: str, deescalation_trigger: str = None) -> Dict[str, Any]:
        system_prompt = "Ты — Тактический стратег (Strategist-Bot)..."
        if deescalation_trigger:
            system_prompt += f"\n[DE-ESCALATION INSTRUCTION]: Предшествующий вариант стратегии содержал критические риски: {deescalation_trigger}. Снизь уровень агрессии позиции, предложи компромиссные бесконфликтные шаги."

        response = await self.llm.generate(
            prompt=query,
            system_prompt=system_prompt,
            context={"laws": laws, "cases": cases_markdown},
            response_format={"type": "json_object"}
        )
        return json.loads(response)

    async def _run_risk_audit(self, strategy: Dict, laws: Dict) -> Dict[str, Any]:
        system_prompt = "Ты — Аудитор рисков (Risk-Bot)..."
        response = await self.llm.generate(
            prompt=json.dumps(strategy),
            system_prompt=system_prompt,
            context={"laws_basis": laws},
            response_format={"type": "json_object"}
        )
        return json.loads(response)

    async def _run_negotiator(self, query: str, laws: Dict) -> Optional[Dict[str, Any]]:
        if not self.privacy_mode:
            return {"status": "SKIPPED", "reason": "Privacy Mode отключен. Доступ к закрытой базе заблокирован."}
            
        internal_experience = await self.db.search(
            collection_name="collection_internal",
            query=query
        )
        system_prompt = "Ты — Переговорщик (Negotiator-Bot)..."
        response = await self.llm.generate(
            prompt=query,
            system_prompt=system_prompt,
            context={"laws": laws, "internal_db_slice": internal_experience},
            response_format={"type": "json_object"}
        )
        return json.loads(response)

    async def _run_draft_bot(self, strategy: Dict, laws: Dict, cases_markdown: str) -> Dict[str, Any]:
        system_prompt = "Ты — Архитектор документов (Draft-Bot)..."
        response = await self.llm.generate(
            prompt=f"На основе стратегии: {json.dumps(strategy)} подготовь итоговый юридический документ.",
            system_prompt=system_prompt,
            context={"laws": laws, "cases": cases_markdown}
        )
        return {"document_markdown": response}

    def _requires_negotiation(self, query: str) -> bool:
        keywords = ["досудебн", "мирное", "переговор", "компромисс", "медиация"]
        return any(word in query.lower() for word in keywords)
