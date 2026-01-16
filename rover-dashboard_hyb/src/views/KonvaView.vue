<template>
  <div class="flex flex-col md:flex-row m-2 items-start gap-4">
    <KonvaField />
    <div class="flex flex-col gap-4 w-full">
      <KonvaController :ros-url="rosUrl" />
      <KonvaDataRobot />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import ROSLIB from 'roslib';
import KonvaController from '../components/konva/Controller.vue';
import KonvaDataRobot from '../components/konva/DataRobot.vue';
import KonvaField from '../components/konva/Field.vue';
import { useKonvaRobotStore } from '../stores/konvaRobot';

const FIELD_HEIGHT = 716;
const FIELD_WIDTH = 1016;
const OFFSET = 40;
const WORLD_X_MAX = FIELD_HEIGHT - 2 * OFFSET; // vertical span (UI X)
const WORLD_Y_MAX = FIELD_WIDTH - 2 * OFFSET; // horizontal span (UI Y)

const ROBOT_STATE = useKonvaRobotStore();

const rosUrl = computed(() => {
  const storedHost =
    localStorage.getItem('rosbridgeHost') ||
    localStorage.getItem('rosboardHost') ||
    localStorage.getItem('ip') ||
    window.location.hostname ||
    'localhost';
  const storedPort = localStorage.getItem('rosbridgePort') || '9090';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${storedHost}:${storedPort}`;
});

let ros = null;
let odomListener = null;
let poseListener = null;

const safe = (v) => (Number.isFinite(v) ? v : 0);
const yawFromQuaternion = (q) => {
  const x = safe(q?.x);
  const y = safe(q?.y);
  const z = safe(q?.z);
  const w = safe(q?.w);
  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  return Math.atan2(sinyCosp, cosyCosp);
};

onMounted(() => {
  ROBOT_STATE.resetDataRobot();

  ros = new ROSLIB.Ros({ url: rosUrl.value });

  odomListener = new ROSLIB.Topic({
    ros,
    name: '/odom',
    messageType: 'nav_msgs/msg/Odometry',
  });

  poseListener = new ROSLIB.Topic({
    ros,
    name: '/robot_pose2d',
    messageType: 'geometry_msgs/msg/Pose2D',
  });

  // velocities from odom
  odomListener.subscribe((message) => {
    const lin = message.twist?.twist?.linear || {};
    const ang = message.twist?.twist?.angular || {};
    const q = message.pose?.pose?.orientation || {};
    const yaw = yawFromQuaternion(q);

    // /odom twist is in child frame; convert to world axes:
    // ROS world axes: +X right, +Y up
    const vxBody = safe(lin.x);
    const vyBody = safe(lin.y);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const vxWorldRos = c * vxBody - s * vyBody;
    const vyWorldRos = s * vxBody + c * vyBody;

    // UI axes: +X up, +Y right (swap from ROS)
    ROBOT_STATE.dataRobot.v_x = vyWorldRos;
    ROBOT_STATE.dataRobot.v_y = vxWorldRos;
    ROBOT_STATE.dataRobot.v_theta = safe(ang.z);
  });

  // pose from robot_pose2d
  poseListener.subscribe((message) => {
    // /robot_pose2d follows /odom pose: ROS axes (+X right, +Y up)
    const rosX = safe(message.x);
    const rosY = safe(message.y);

    // UI axes: +X up, +Y right (swap from ROS)
    const uiX = rosY;
    const uiY = rosX;

    // keep UI pose within map bounds (origin bottom-left)
    ROBOT_STATE.dataRobot.pos_x = Math.max(0, Math.min(WORLD_X_MAX, uiX));
    ROBOT_STATE.dataRobot.pos_y = Math.max(0, Math.min(WORLD_Y_MAX, uiY));
    ROBOT_STATE.dataRobot.pos_theta = safe(message.theta);
  });
});

onBeforeUnmount(() => {
  if (odomListener) {
    odomListener.unsubscribe();
    odomListener = null;
  }
  if (poseListener) {
    poseListener.unsubscribe();
    poseListener = null;
  }
  if (ros) {
    ros.close();
    ros = null;
  }
});
</script>
