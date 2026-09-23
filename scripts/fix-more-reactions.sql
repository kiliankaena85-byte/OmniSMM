DO $$
DECLARE
  reaction_cat_id TEXT;
BEGIN
  SELECT id INTO reaction_cat_id FROM "Category" WHERE name = 'Telegram Реакции / Эмодзи' LIMIT 1;
  
  IF reaction_cat_id IS NOT NULL THEN
    -- Update service 2921
    UPDATE "Service" SET name = 'Реакции (Эконом, Микс 1)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2921;

    -- Update service 2923
    UPDATE "Service" SET name = 'Реакции (Эконом, Микс 2)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2923;

    -- Update service 2925
    UPDATE "Service" SET name = 'Реакции (Эконом, Сердечки)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2925;

    -- Update service 2926
    UPDATE "Service" SET name = 'Реакции (Эконом, Класс)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2926;

    -- Update service 2927
    UPDATE "Service" SET name = 'Реакции (Эконом, Огонь)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2927;

    -- Update service 2928
    UPDATE "Service" SET name = 'Реакции (Эконом, Аплодисменты)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2928;

    -- Update service 2929
    UPDATE "Service" SET name = 'Реакции (Эконом, Гнев)', "categoryId" = reaction_cat_id, "targetType" = 'POST' WHERE "numericId" = 2929;
  END IF;

  -- Fix the empty name for 4083
  UPDATE "Service"
  SET name = 'Подписчики / Участники (Базовые)'
  WHERE "numericId" = 4083 AND name = 'Telegram:';

END $$;
