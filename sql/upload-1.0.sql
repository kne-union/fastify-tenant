-- 为 t_tenant_org 表添加 leader_user_id 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
        AND table_name = 't_tenant_org'
        AND column_name = 'leader_user_id'
    ) THEN
ALTER TABLE "v1"."t_tenant_org"
    ADD COLUMN leader_user_id int8;

COMMENT ON COLUMN "v1".t_tenant_org.leader_user_id IS '部门负责人（租户用户ID）';

ALTER TABLE "v1"."t_tenant_org"
    ADD CONSTRAINT t_tenant_org_leader_user_id_fkey
        FOREIGN KEY (leader_user_id) REFERENCES "v1".t_tenant_user(id) ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

-- t_tenant_company：公司基本信息扩展字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'logo'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN logo VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'industry'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN industry VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'scale'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN scale VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'address'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN address VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'phone'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN phone VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'email'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN email VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'founded_date'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN founded_date DATE;
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_company'
          AND column_name = 'company_tags'
    ) THEN
ALTER TABLE "v1"."t_tenant_company" ADD COLUMN company_tags JSONB NOT NULL DEFAULT '[]'::jsonb;
END IF;
END $$;

-- 历史数据：company_tags 为空时补默认数组（列已存在但无默认时也可安全执行）
UPDATE "v1"."t_tenant_company"
SET company_tags = '[]'::jsonb
WHERE company_tags IS NULL;

COMMENT ON COLUMN "v1".t_tenant_company.logo IS 'Logo';
COMMENT ON COLUMN "v1".t_tenant_company.industry IS '行业';
COMMENT ON COLUMN "v1".t_tenant_company.scale IS '规模';
COMMENT ON COLUMN "v1".t_tenant_company.address IS '地址';
COMMENT ON COLUMN "v1".t_tenant_company.phone IS '电话';
COMMENT ON COLUMN "v1".t_tenant_company.email IS '邮箱';
COMMENT ON COLUMN "v1".t_tenant_company.founded_date IS '成立日期';
COMMENT ON COLUMN "v1".t_tenant_company.company_tags IS '公司标签';

ALTER TABLE "v1"."t_tenant_user"
    ADD COLUMN IF NOT EXISTS tenant_org_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
-- 可选：把现有 tenant_org_id 回填到数组
UPDATE "v1"."t_tenant_user"
SET tenant_org_ids = jsonb_build_array(tenant_org_id::text)
WHERE tenant_org_id IS NOT NULL AND (tenant_org_ids IS NULL OR tenant_org_ids = '[]'::jsonb);

-- t_tenant_org：添加同步相关字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_org'
          AND column_name = 'status'
    ) THEN
ALTER TABLE "v1"."t_tenant_org" ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'));
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_org'
          AND column_name = 'synced'
    ) THEN
ALTER TABLE "v1"."t_tenant_org" ADD COLUMN synced BOOLEAN NOT NULL DEFAULT FALSE;
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_org'
          AND column_name = 'sync_source'
    ) THEN
ALTER TABLE "v1"."t_tenant_org" ADD COLUMN sync_source VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_org'
          AND column_name = 'source_id'
    ) THEN
ALTER TABLE "v1"."t_tenant_org" ADD COLUMN source_id VARCHAR(255);
END IF;
END $$;

COMMENT ON COLUMN "v1".t_tenant_org.status IS '状态:开启，关闭';
COMMENT ON COLUMN "v1".t_tenant_org.synced IS '是否通过同步进入系统';
COMMENT ON COLUMN "v1".t_tenant_org.sync_source IS '同步源标识';
COMMENT ON COLUMN "v1".t_tenant_org.source_id IS '同步源中的原始ID';

-- t_tenant_org 唯一索引：同一租户同一同步源下 sourceId 唯一
CREATE UNIQUE INDEX IF NOT EXISTS t_tenant_org_sync_source_id_uniq
    ON "v1"."t_tenant_org" (tenant_id, sync_source, source_id)
    WHERE deleted_at IS NULL AND synced = TRUE;

-- t_tenant_user：添加同步相关字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_user'
          AND column_name = 'synced'
    ) THEN
ALTER TABLE "v1"."t_tenant_user" ADD COLUMN synced BOOLEAN NOT NULL DEFAULT FALSE;
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_user'
          AND column_name = 'sync_source'
    ) THEN
ALTER TABLE "v1"."t_tenant_user" ADD COLUMN sync_source VARCHAR(255);
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'v1'
          AND table_name = 't_tenant_user'
          AND column_name = 'source_id'
    ) THEN
ALTER TABLE "v1"."t_tenant_user" ADD COLUMN source_id VARCHAR(255);
END IF;
END $$;

COMMENT ON COLUMN "v1".t_tenant_user.synced IS '是否通过同步进入系统';
COMMENT ON COLUMN "v1".t_tenant_user.sync_source IS '同步源标识';
COMMENT ON COLUMN "v1".t_tenant_user.source_id IS '同步源中的原始ID';

-- t_tenant_user 唯一索引：同一租户同一同步源下 sourceId 唯一
CREATE UNIQUE INDEX IF NOT EXISTS t_tenant_user_sync_source_id_uniq
    ON "v1"."t_tenant_user" (tenant_id, sync_source, source_id)
    WHERE deleted_at IS NULL AND synced = TRUE;

-- t_tenant_user 邮箱唯一索引（含 sync_source）
DROP INDEX IF EXISTS "t_tenant_user_tenant_id_email";
DROP INDEX IF EXISTS "t_tenant_users_tenant_id_email";
DROP INDEX IF EXISTS "t_tenant_user_tenant_id_email_uk";
DROP INDEX IF EXISTS "t_tenant_users_tenant_id_email_uk";
CREATE UNIQUE INDEX IF NOT EXISTS "t_tenant_user_tenant_email_sync_source_uniq"
    ON "v1"."t_tenant_user" (tenant_id, email, sync_source)
    WHERE deleted_at IS NULL;

-- t_tenant_org_sync：组织同步记录表
CREATE TABLE IF NOT EXISTS "v1"."t_tenant_org_sync" (
                                                        id SERIAL PRIMARY KEY,
                                                        type VARCHAR(255),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
                               options JSONB,
                               tenant_id INT8 NOT NULL REFERENCES "v1".t_tenant(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
                               );

COMMENT ON TABLE "v1"."t_tenant_org_sync" IS '组织同步记录';
COMMENT ON COLUMN "v1".t_tenant_org_sync.type IS '同步源类型';
COMMENT ON COLUMN "v1".t_tenant_org_sync.config IS '同步配置';
COMMENT ON COLUMN "v1".t_tenant_org_sync.status IS '同步状态';
COMMENT ON COLUMN "v1".t_tenant_org_sync.last_sync_at IS '最后同步时间';
COMMENT ON COLUMN "v1".t_tenant_org_sync.options IS '扩展字段';

-- t_tenant_third_login：第三方登录配置表
CREATE TABLE IF NOT EXISTS "v1"."t_tenant_third_login" (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    options JSONB,
    tenant_id INT8 NOT NULL REFERENCES "v1".t_tenant(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE "v1"."t_tenant_third_login" IS '第三方登录配置';
COMMENT ON COLUMN "v1".t_tenant_third_login.type IS '第三方登录渠道类型';
COMMENT ON COLUMN "v1".t_tenant_third_login.config IS '第三方登录配置';
COMMENT ON COLUMN "v1".t_tenant_third_login.options IS '扩展字段';

CREATE UNIQUE INDEX IF NOT EXISTS t_tenant_third_login_tenant_type_uniq
    ON "v1"."t_tenant_third_login" (tenant_id, type)
    WHERE deleted_at IS NULL;


BEGIN;

-- 删除旧索引（覆盖 Sequelize sync 常见命名）
DROP INDEX IF EXISTS "t_tenant_user_tenant_id_email";
DROP INDEX IF EXISTS "t_tenant_users_tenant_id_email";
DROP INDEX IF EXISTS "t_tenant_user_tenant_id_email_uk";
DROP INDEX IF EXISTS "t_tenant_users_tenant_id_email_uk";

-- 新建含 sync_source 的部分唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "t_tenant_user_tenant_email_sync_source_uniq"
    ON t_tenant_user (tenant_id, email, sync_source)
    WHERE deleted_at IS NULL;

COMMIT;