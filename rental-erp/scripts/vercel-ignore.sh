#!/usr/bin/env bash
# Vercel 'Ignored Build Step': exit 0 = 이번 빌드 건너뜀, exit 1 = 빌드
# 무료 요금제 배포 한도를 아끼려고, 운영(production)이면서 rental-erp 폴더가 바뀐 경우에만 빌드한다.

# 미리보기(다른 브랜치) 배포는 하지 않는다
if [ "$VERCEL_ENV" != "production" ]; then
  echo "미리보기 배포 건너뜀"
  exit 0
fi

# 마지막으로 성공한 배포 이후 rental-erp 폴더에 바뀐 내용이 없으면 건너뜀
# (비교할 커밋을 알 수 없으면 안전하게 빌드)
prev="$VERCEL_GIT_PREVIOUS_SHA"
if [ -n "$prev" ] && git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  if git diff --quiet "$prev" HEAD -- .; then
    echo "rental-erp 변경 없음 → 건너뜀"
    exit 0
  fi
fi
echo "빌드합니다"
exit 1
