# dash_hybrid

term 1 (in rosboard-main)
```
build and source
```
```
ros2 run rosboard rosboard_node
```

term 2
```
ros2 launch rosbridge_server rosbridge_websocket_launch.xml address:=0.0.0.0 port:=9090
```

term 3 (to run dashboard in rover-dashboard_hyb)
```
pnpm install
pnpm dev
```

term 4 (to test cam)

build and source in rover-dashboard_hyb
```
cd cam_min
ros2 run cam_min camera_publisher --ros-args
```

# RoslibVue + Konva_ws

term 1 (in konva_ws)
```
build and source
```
```
ros2 run konva_ros konva_node
```

term 2
```
ros2 launch rosbridge_server rosbridge_websocket_launch.xml address:=0.0.0.0 port:=9090
```

term 3 ( in roslib_vue)
```
npm install
npm run dev
```

