# ROS 2 integration workspace

This directory contains ROS 2 Humble packages that complement the rover dashboard web application.

## Workspace setup

```bash
cd ros2
colcon build --packages-select test_topic_pkg
source install/setup.bash
ros2 run test_topic_pkg test_node
```

The `test_topic_pkg` node publishes the `/test` topic with an initial integer value of `5` and logs any updates it receives. The rover dashboard UI can send new values to the same topic via rosbridge.
