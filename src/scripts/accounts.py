# 계정 관리 (관리자용, 공개 가입은 없다). src 폴더에서 실행한다
#
#   python -m scripts.accounts list
#   python -m scripts.accounts claim 1 demo --role admin        기존 1번 사용자에 아이디·비밀번호를 붙인다
#   python -m scripts.accounts create tester1 --role tester      새 계정 (비밀번호는 무작위로 만들어 한 번만 보여 준다)
#   python -m scripts.accounts reset tester1                     비밀번호 다시 만들기 (그 계정의 로그인은 모두 끊긴다)
#   python -m scripts.accounts disable tester1 / enable tester1
#   python -m scripts.accounts clone showcase booth26 --seed     자료와 태그 연결을 복사 (부스 계정 준비용)
#
# 역할: admin, showcase (상한 없음, 30일 유지) / tester (주 150회, 7일 유지) / booth (하루 100회, 그날 밤까지)
import argparse
import sys

from database.database import SessionLocal
from database.models import content_class, contenttag_class, users_class, usersession_class
from services.auth import ROLE_DEFAULTS, generate_password, hash_password


def _get(db, username):
    user = db.query(users_class).filter(users_class.username == username).first()
    if not user:
        sys.exit(f"없는 아이디입니다: {username}")
    return user


def _apply_role(user, role, limit, period):
    defaults = ROLE_DEFAULTS[role]
    user.role = role
    user.ai_limit = limit if limit is not None else defaults["ai_limit"]
    user.ai_period = period if period is not None else defaults["ai_period"]


def _print_password(username, password):
    print(f"아이디: {username}")
    print(f"비밀번호: {password}")
    print("(이 비밀번호는 다시 볼 수 없습니다. 지금 받아 적으세요)")


def cmd_list(db, _args):
    rows = db.query(users_class).order_by(users_class.users_id).all()
    print(f"{'번호':>4}  {'아이디':<12} {'역할':<9} {'AI 상한':<10} {'자료':>4}  상태")
    for u in rows:
        n = db.query(content_class).filter(content_class.users_id == u.users_id).count()
        limit = f"{u.ai_limit}/{'주' if u.ai_period == 'week' else '일'}" if u.ai_limit is not None else "없음"
        state = "막힘" if u.disabled else ("로그인 가능" if u.password_hash else "비밀번호 없음")
        print(f"{u.users_id:>4}  {u.username or '-':<12} {u.role or '-':<9} {limit:<10} {n:>4}  {state}")


def cmd_create(db, args):
    if db.query(users_class).filter(users_class.username == args.username).first():
        sys.exit(f"이미 있는 아이디입니다: {args.username}")
    password = generate_password()
    user = users_class(username=args.username, password_hash=hash_password(password))
    _apply_role(user, args.role, args.limit, args.period)
    db.add(user)
    db.commit()
    _print_password(args.username, password)


def cmd_claim(db, args):
    user = db.query(users_class).filter(users_class.users_id == args.id).first()
    if not user:
        sys.exit(f"없는 사용자 번호입니다: {args.id}")
    other = db.query(users_class).filter(users_class.username == args.username).first()
    if other and other.users_id != user.users_id:
        sys.exit(f"이미 다른 사용자가 쓰는 아이디입니다: {args.username}")
    password = generate_password()
    user.username = args.username
    user.password_hash = hash_password(password)
    _apply_role(user, args.role, args.limit, args.period)
    db.commit()
    _print_password(args.username, password)


def cmd_reset(db, args):
    user = _get(db, args.username)
    password = generate_password()
    user.password_hash = hash_password(password)
    db.query(usersession_class).filter(usersession_class.users_id == user.users_id).delete()
    db.commit()
    _print_password(args.username, password)


def cmd_disable(db, args, value=True):
    user = _get(db, args.username)
    user.disabled = value
    if value:
        db.query(usersession_class).filter(usersession_class.users_id == user.users_id).delete()
    db.commit()
    print(f"{args.username}: {'막음' if value else '다시 허용'}")


def cmd_clone(db, args):
    src = _get(db, args.source)
    dst = _get(db, args.target)
    rows = db.query(content_class).filter(content_class.users_id == src.users_id).order_by(content_class.Content_id).all()
    for c in rows:
        copy = content_class(
            users_id=dst.users_id, category=c.category, source=c.source, title=c.title,
            summary=c.summary, URL=c.URL, memo=c.memo, created_at=c.created_at,
            analysis_status=c.analysis_status or "ai", is_seed=bool(args.seed),
        )
        db.add(copy)
        db.flush()
        for link in db.query(contenttag_class).filter(contenttag_class.Content_id == c.Content_id).all():
            db.add(contenttag_class(Content_id=copy.Content_id, Tag_id=link.Tag_id))
    db.commit()
    print(f"{args.source} → {args.target}: 자료 {len(rows)}건 복사{' (기본 자료 표시)' if args.seed else ''}")


def main():
    parser = argparse.ArgumentParser(description="KNOT 계정 관리")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")

    def role_args(p):
        p.add_argument("--role", choices=sorted(ROLE_DEFAULTS), default="tester")
        p.add_argument("--limit", type=int, default=None, help="AI 사용 상한 (역할 기본값 대신)")
        p.add_argument("--period", choices=["day", "week"], default=None)

    p = sub.add_parser("create")
    p.add_argument("username")
    role_args(p)
    p = sub.add_parser("claim")
    p.add_argument("id", type=int)
    p.add_argument("username")
    role_args(p)
    for name in ("reset", "disable", "enable"):
        sub.add_parser(name).add_argument("username")
    p = sub.add_parser("clone")
    p.add_argument("source")
    p.add_argument("target")
    p.add_argument("--seed", action="store_true", help="복사한 자료에 '기본 자료' 표시")

    args = parser.parse_args()
    db = SessionLocal()
    try:
        {
            "list": cmd_list, "create": cmd_create, "claim": cmd_claim, "reset": cmd_reset,
            "disable": cmd_disable, "enable": lambda d, a: cmd_disable(d, a, False), "clone": cmd_clone,
        }[args.cmd](db, args)
    finally:
        db.close()


if __name__ == "__main__":
    main()
