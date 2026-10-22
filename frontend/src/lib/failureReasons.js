// 서버가 X-Error-Code로 알려 주는 실패 이유. paste: 본문 붙여넣기를 권할지, retry: 다시 시도를 보여 줄지
// detail: 서버의 설명을 help 앞에 붙일지 (상한처럼 서버 설정에 따라 바뀌는 값이 들어 있을 때)
export const FAILURE_REASONS = {
  LOGIN_WALL: {
    title: "로그인해야 보이는 페이지로 보입니다",
    help: "브라우저에서 페이지를 열고 본문을 복사해 붙여 넣으면 AI가 분석합니다.",
    paste: true,
  },
  BLOCKED_URL: {
    title: "이 주소는 분석할 수 없습니다",
    help: "서버 안쪽(이 컴퓨터, 공유기, 사내망)을 가리키는 주소는 서버가 대신 열지 않습니다. 메모를 써서 링크만 저장해 둘 수 있습니다.",
  },
  FETCH_FAIL: {
    title: "페이지를 불러오지 못했습니다",
    help: "접속이 막혔거나 시간이 초과됐습니다. 본문을 붙여 넣거나, 메모를 써서 링크만 저장해 둘 수 있습니다.",
    paste: true,
  },
  NO_TEXT: {
    title: "읽을 만한 본문을 찾지 못했습니다",
    help: "영상이나 이미지 위주의 페이지일 수 있습니다. 글이 있다면 붙여 넣고, 없다면 메모를 써서 저장하세요.",
    paste: true,
  },
  TOO_SHORT: {
    title: "본문이 너무 짧습니다",
    help: "페이지에서 더 긴 본문을 복사해 붙여 넣거나, 메모를 써서 저장하세요.",
    paste: true,
  },
  AI_FAIL: {
    title: "AI 분석에 실패했습니다",
    help: "잠시 뒤 다시 시도하거나, 메모를 써서 저장하세요.",
    retry: true,
  },
  AI_QUOTA: {
    title: "AI 사용 한도에 도달했습니다",
    help: "AI 없이 메모를 써서 저장할 수 있습니다.",
  },
  PDF_NO_TEXT: {
    title: "글자를 읽을 수 없는 PDF입니다 (스캔본)",
    help: "문자 인식은 지원하지 않습니다. 메모를 써서 저장해 두세요.",
  },
  PDF_LOCKED: {
    title: "암호가 걸린 PDF입니다",
    help: "암호를 푼 파일로 다시 넣거나, 메모를 써서 저장하세요.",
  },
  PDF_TOO_BIG: {
    title: "PDF가 너무 큽니다",
    help: "메모를 써서 저장해 둘 수 있습니다.",
    detail: true,
  },
}

// 이 실패를 패널로 처리할지 (아니면 알림 한 줄)
export function isRecoverable(code) {
  return code in FAILURE_REASONS
}
