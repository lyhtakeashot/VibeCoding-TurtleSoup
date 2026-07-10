@echo off
set PATH=C:\Users\lyh\.workbuddy\binaries\node\versions\22.22.2;%PATH%
cd /d d:\Desktop\VibeCoding\海龟汤
call npm run dev >> dev.log 2>> dev.err
