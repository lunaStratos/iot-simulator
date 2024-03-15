#!/bin/bash

# Vue build
echo "Start building your VUE project"
cd ./frontend
npm run build

cd ../

# http express server start
# with MQTT
echo "Start Backend"
cd ./backend
npm start

cd ../

exit 0