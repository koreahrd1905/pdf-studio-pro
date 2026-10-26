# PDF Studio Pro (PDF 변환 & 편집기)

웹 브라우저에서 편리하게 PDF 페이지를 분리, 결합, 순서 재배열하고 기존 글씨 수정 및 화이트아웃 지우개 기능을 제공하는 웹 애플리케이션입니다.

## 주요 기능
- **다중 PDF 업로드 및 페이지 미리보기**: 여러 PDF 파일을 한눈에 비교하고 드래그 앤 드롭으로 작업창에 추가
- **자유로운 순서 조작**: ◀ / ▶ 1칸 이동, 페이지 번호 직접 변경, 마우스 드래그 앤 드롭 삽입 (후속 카드 밀림 모션)
- **300% 고해상도 확대 (🔍)**: 돋보기 버튼 클릭으로 원본 선명도로 300% 확대 팝업 확인
- **PDF 기존 텍스트 수정 및 지우개**:
  - 원본 글자 자동 감지 및 1-클릭 화이트아웃 교체
  - 화이트아웃 + 새 텍스트 패치
  - 불필요한 번호/로고 등을 지우는 영역 지우개 (Whiteout Eraser)
- **로컬 & 클라우드(Render) 지원**: 클라이언트 브라우저 PDF 생성 엔진(pdf-lib) 및 파이썬 백엔드(pypdf + reportlab) 듀얼 엔진 지원

## 배포 및 실행 방법

### 로컬 실행
`실행하기.bat` 더블 클릭 또는:
```bash
pip install -r requirements.txt
python server.py
```
브라우저에서 `http://localhost:8080/index.html` 접속

### Render (랜더) 배포
- **Environment**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python server.py`
