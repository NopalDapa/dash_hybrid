<script>
import ROSLIB from "roslib";
import { useRobotStore } from "./stores/store.js";

const FIELD_HEIGHT = 716;
const FIELD_WIDTH = 1016;
const OFFSET = 40; // keep the robot fully visible while treating (0,0) as bottom-left
const WORLD_X_MAX = FIELD_HEIGHT - 2 * OFFSET; // vertical span
const WORLD_Y_MAX = FIELD_WIDTH - 2 * OFFSET; // horizontal span

export default {
  setup() {
    const ROBOT_STATE = useRobotStore();
    return {
      ROBOT_STATE,
    };
  },
  data() {
    return {
      ros: null,
      odomListener: null,
      poseListener: null,

      //data yang di publish
      toPC: null,
    };
  },
  async beforeMount() {
    await this.init();
    this.subscribe();
  },
  created() {
    this.ROBOT_STATE.resetDataRobot();
  },
  methods: {
    async init() {
      this.ros = new ROSLIB.Ros({
        url: "ws://localhost:9090", // Sesuaikan URL dengan alamat ROS Bridge Anda
      });

      this.odomListener = new ROSLIB.Topic({
        ros: this.ros,
        name: "/odom",
        messageType: "nav_msgs/msg/Odometry",
      });

      this.poseListener = new ROSLIB.Topic({
        ros: this.ros,
        name: "/robot_pose2d",
        messageType: "geometry_msgs/msg/Pose2D",
      });
    },
    subscribe() {
      let that = this;
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

      // velocities from odom
      that.odomListener.subscribe(function (message) {
        const lin = message.twist.twist.linear || {};
        const ang = message.twist.twist.angular || {};
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
        that.ROBOT_STATE.dataRobot.v_x = vyWorldRos;
        that.ROBOT_STATE.dataRobot.v_y = vxWorldRos;
        that.ROBOT_STATE.dataRobot.v_theta = safe(ang.z);
      });

      // pose from robot_pose2d
      that.poseListener.subscribe(function (message) {
        // /robot_pose2d follows /odom pose: ROS axes (+X right, +Y up)
        const rosX = safe(message.x);
        const rosY = safe(message.y);

        // UI axes: +X up, +Y right (swap from ROS)
        const uiX = rosY;
        const uiY = rosX;

        // keep UI pose within map bounds (origin bottom-left)
        that.ROBOT_STATE.dataRobot.pos_x = Math.max(0, Math.min(WORLD_X_MAX, uiX));
        that.ROBOT_STATE.dataRobot.pos_y = Math.max(0, Math.min(WORLD_Y_MAX, uiY));
        that.ROBOT_STATE.dataRobot.pos_theta = safe(message.theta);
      });
    },
    publish() {
      this.publisher.publish(this.toPC);
    },
    beforeDestroy() {
      // Berhenti mendengarkan topik sebelum komponen dihancurkan
      if (this.odomListener) {
        this.odomListener.unsubscribe();
      }
      if (this.poseListener) {
        this.poseListener.unsubscribe();
      }
    },
  },
};
</script>

<template>
  <router-view> </router-view>
</template>
