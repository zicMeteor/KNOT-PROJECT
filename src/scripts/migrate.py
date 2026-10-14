# v1 DB를 v2에 맞춘다: 새 표를 만들고, 이미 있는 표에 빠진 칸을 더한다
# 여러 번 실행해도 안전하다 (있는 칸은 건너뛴다). 자료는 지우거나 바꾸지 않는다
#
# 실행 (src 폴더에서):  python -m scripts.migrate
# 실행 전에 백업을 권장 (저장소 폴더 밖에 둔다):  mysqldump -u root -p KNOT > ../../KNOT-Backup/knot_backup.sql
from sqlalchemy import inspect, text

from database.database import Base, engine
import database.models  # noqa: F401  (표 정의를 Base에 등록)

# 표 이름 -> [(칸 이름, MySQL 칸 정의)]
NEW_COLUMNS = {
    "users": [
        ("username", "VARCHAR(50) NULL"),
        ("password_hash", "VARCHAR(255) NULL"),
        ("role", "VARCHAR(20) NULL"),
        ("ai_limit", "INT NULL"),
        ("ai_period", "VARCHAR(10) NULL"),
        ("disabled", "TINYINT(1) NOT NULL DEFAULT 0"),
    ],
    "content": [
        ("analysis_status", "VARCHAR(20) NULL DEFAULT 'ai'"),
        ("is_seed", "TINYINT(1) NOT NULL DEFAULT 0"),
    ],
    "eventlog": [
        ("users_id", "INT NULL"),
    ],
    "agenthistory": [
        ("users_id", "INT NULL"),
        ("run_id", "VARCHAR(36) NULL"),
        ("kind", "VARCHAR(20) NULL"),
        ("before_json", "TEXT NULL"),
        ("after_json", "TEXT NULL"),
        ("undone", "TINYINT(1) NOT NULL DEFAULT 0"),
    ],
}


def main():
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # 1) 이미 있는 표에 빠진 칸 더하기
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            if table not in existing_tables:
                continue  # 아래 create_all이 처음부터 만든다
            have = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns:
                if name in have:
                    continue
                conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{name}` {ddl}"))
                print(f"칸 추가: {table}.{name}")

        # 아이디 중복 방지 (이미 있으면 건너뜀)
        if "users" in existing_tables:
            indexes = {i["name"] for i in inspect(conn).get_indexes("users")}
            if "uq_users_username" not in indexes and "username" not in indexes:
                conn.execute(text("ALTER TABLE `users` ADD UNIQUE INDEX `uq_users_username` (`username`)"))
                print("인덱스 추가: users.username (중복 불가)")

        # v1 자료: 분석 상태가 비어 있으면 '보통 분석'으로
        if "content" in existing_tables:
            conn.execute(text("UPDATE content SET analysis_status = 'ai' WHERE analysis_status IS NULL"))

    # 2) 새 표 만들기 (usersession, aiusage, feedback, graphsnapshot 등)
    before = set(inspect(engine).get_table_names())
    Base.metadata.create_all(bind=engine)
    for t in sorted(set(inspect(engine).get_table_names()) - before):
        print(f"표 추가: {t}")

    print("완료")


if __name__ == "__main__":
    main()
