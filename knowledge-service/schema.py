import logging

logger = logging.getLogger(__name__)

def init_neo4j_schema(driver):
    """
    Initializes graph db constraints and fulltext indexes.
    Safe to run multiple times.
    """
    logger.info("Initializing Neo4j Schema...")
    
    constraints = [
        "CREATE CONSTRAINT adr_id_unique IF NOT EXISTS FOR (n:ADR) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT biz_id_unique IF NOT EXISTS FOR (n:BusinessRule) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT conv_id_unique IF NOT EXISTS FOR (n:Convention) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT debt_id_unique IF NOT EXISTS FOR (n:TechDebt) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT code_id_unique IF NOT EXISTS FOR (n:CodeEntity) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT api_id_unique IF NOT EXISTS FOR (n:APIContract) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT dec_id_unique IF NOT EXISTS FOR (n:Decision) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT domain_id_unique IF NOT EXISTS FOR (n:DomainKnowledge) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT inc_id_unique IF NOT EXISTS FOR (n:Incident) REQUIRE n.id IS UNIQUE",
    ]
    
    with driver.session() as session:
        # Create unique constraints
        for constraint in constraints:
            try:
                session.run(constraint)
            except Exception as e:
                logger.warning(f"Could not apply constraint '{constraint}': {e}")
        
        # Create fulltext index for hybrid keyword queries
        try:
            session.run(
                """
                CREATE FULLTEXT INDEX knowledge_search IF NOT EXISTS
                FOR (n:ADR|BusinessRule|Convention|TechDebt|CodeEntity|APIContract|Decision|DomainKnowledge)
                ON EACH [n.title, n.content_preview, n.tags]
                """
            )
            logger.info("Created Neo4j fulltext index 'knowledge_search'.")
        except Exception as e:
            logger.warning(f"Could not create Neo4j fulltext search index: {e}")
            
        # Create composite indices for fast queries
        indices = [
            "CREATE INDEX code_file_path IF NOT EXISTS FOR (n:CodeEntity) ON (n.file_path)",
            "CREATE INDEX code_name IF NOT EXISTS FOR (n:CodeEntity) ON (n.name)"
        ]
        for index in indices:
            try:
                session.run(index)
            except Exception as e:
                logger.warning(f"Could not apply index '{index}': {e}")
                
    logger.info("Neo4j Schema initialization completed successfully.")
