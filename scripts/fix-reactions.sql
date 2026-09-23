DO $$
DECLARE
  reaction_cat_id TEXT;
BEGIN
  SELECT id INTO reaction_cat_id FROM "Category" WHERE name = 'Telegram Реакции / Эмодзи' LIMIT 1;
  
  IF reaction_cat_id IS NOT NULL THEN
    -- Update service 2920 (Positive reactions)
    UPDATE "Service" 
    SET name = 'Реакции (Стандарт)', "categoryId" = reaction_cat_id, "targetType" = 'POST'
    WHERE "numericId" = 2920;

    -- Update service 2922 (Positive reactions)
    UPDATE "Service" 
    SET name = 'Реакции (Эконом)', "categoryId" = reaction_cat_id, "targetType" = 'POST'
    WHERE "numericId" = 2922;

    -- Update service 2924 (Negative reactions)
    UPDATE "Service" 
    SET name = 'Реакции (Эконом, Отрицательные)', "categoryId" = reaction_cat_id, "targetType" = 'POST'
    WHERE "numericId" = 2924;
  ELSE
    RAISE NOTICE 'Category Telegram Реакции / Эмодзи not found!';
  END IF;

  -- Fix the empty name for 4883
  UPDATE "Service"
  SET name = 'Подписчики / Участники (Базовые)'
  WHERE "numericId" = 4883 AND name = 'Telegram:';

END $$;
