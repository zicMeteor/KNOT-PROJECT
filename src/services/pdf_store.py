# 올린 PDF 원본 보관: settings.PDF_DIR/{계정 번호}/{자료 번호}_{저장 시각}.pdf
# 저장 시각까지 이름에 넣는다. 자료 번호가 다시 쓰여도(DB를 되살리거나 AUTO_INCREMENT가 되돌아간 경우)
# 지우지 못하고 남은 예전 파일이 새 자료에 붙지 않는다. 누구의 자료인지는 부르는 쪽이 확인한다
import os
import shutil
import tempfile

import settings

# PDF 파일은 이 글자로 시작한다
PDF_MAGIC = b"%PDF-"


def path_for(users_id: int, content_id: int, created_at) -> str:
    stamp = created_at.strftime("%Y%m%d%H%M%S") if created_at else "0"
    return os.path.join(settings.PDF_DIR, str(int(users_id)), f"{int(content_id)}_{stamp}.pdf")


def path_of(content) -> str:
    """content_class 한 줄의 원본 위치"""
    return path_for(content.users_id, content.Content_id, content.created_at)


def has_original(users_id: int, content_id: int, url, created_at) -> bool:
    """PDF 자료(주소 없음)이고 보관한 원본이 있는지"""
    return not url and os.path.isfile(path_for(users_id, content_id, created_at))


def save(path: str, data: bytes):
    """같은 자리에 파일이 있으면 바꾼다. 요청마다 다른 임시 파일에 다 쓴 뒤 이름을 바꿔서,
    동시에 올려도 섞이지 않고 쓰다 만 파일이 남지 않게 한다"""
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, suffix=".part")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def copy(src: str, dst: str):
    """원본이 있으면 다른 자료 자리로 복사한다 (계정 복제용)"""
    if os.path.isfile(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)


def remove(path: str):
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except OSError as e:
        print(f"PDF 파일 삭제 실패: {e}")
