-- 第三方登录同渠道可绑定多套凭证：唯一键改为 (tenant_id, type, targetId)（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_tenant_third_login'
  ) THEN
    DROP INDEX IF EXISTS t_tenant_third_login_tenant_type_uniq;

    CREATE UNIQUE INDEX IF NOT EXISTS t_tenant_third_login_tenant_type_target_uniq
      ON t_tenant_third_login (tenant_id, type, (config->>'targetId'))
      WHERE deleted_at IS NULL;
  END IF;
END $$;
