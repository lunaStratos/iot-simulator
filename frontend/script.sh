#!/bin/bash

# Vue 프로젝트 빌드
echo "Start building your VUE project"

npm run build

# express 시작
echo "Start Backend"
cd ../backend
npm start

exit 0