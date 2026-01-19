<template>
  <div class="basis-1/3 p-4">
    <h3 class="font-semibold mb-2">Teleop Controller</h3>
    <div class="flex flex-col md:flex-row gap-4 items-start">
      <div class="flex flex-col items-center space-y-2">
        <p class="text-sm text-slate-700">Linear (vx, vy)</p>
        <v-stage :config="stageSize">
          <v-layer>
            <v-circle
              :config="{
                x: center.x,
                y: center.y,
                radius: baseRadius,
                stroke: '#94a3b8',
                strokeWidth: 3,
              }"
            />
            <v-circle
              :config="{
                x: knob.x,
                y: knob.y,
                radius: knobRadius,
                fill: '#2563eb88',
                stroke: '#2563eb',
                strokeWidth: 2,
                draggable: true,
              }"
              @dragmove="handleDrag"
              @dragend="resetKnob"
            />
          </v-layer>
        </v-stage>
      </div>

      <div class="flex flex-col items-center space-y-2">
        <p class="text-sm text-slate-700">Angular (ω)</p>
        <v-stage :config="thetaStageSize">
          <v-layer>
            <v-circle
              :config="{
                x: thetaCenter.x,
                y: thetaCenter.y,
                radius: thetaBaseRadius,
                stroke: '#94a3b8',
                strokeWidth: 3,
              }"
            />
            <v-circle
              :config="{
                x: thetaKnob.x,
                y: thetaKnob.y,
                radius: thetaKnobRadius,
                fill: '#0ea5e988',
                stroke: '#0ea5e9',
                strokeWidth: 2,
                draggable: true,
              }"
              @dragmove="handleThetaDrag"
              @dragend="resetThetaKnob"
            />
          </v-layer>
        </v-stage>
        <div class="grid grid-cols-3 gap-2 w-full">
          <button class="btn" @click="nudgeTheta(-0.8)">⟲</button>
          <button class="btn" @click="stop">Stop</button>
          <button class="btn" @click="nudgeTheta(0.8)">⟳</button>
        </div>
      </div>
    </div>

    <div class="text-sm text-slate-700">
      vx: {{ vel.vx.toFixed(2) }} | vy: {{ vel.vy.toFixed(2) }} | ω:
      {{ vel.omega.toFixed(2) }}
    </div>

    <label class="flex items-center space-x-2 text-sm text-slate-700">
      <input type="checkbox" v-model="simulateUi" />
      <span>Simulasikan gerak di UI</span>
    </label>

    <div class="mt-4 space-y-2">
      <p class="text-sm font-semibold text-slate-700">Go to Pose</p>
      <div class="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <input
          v-model.number="goalX"
          type="number"
          placeholder="X"
          class="w-full sm:w-24 border rounded px-2 py-1 text-sm"
        />
        <input
          v-model.number="goalY"
          type="number"
          placeholder="Y"
          class="w-full sm:w-24 border rounded px-2 py-1 text-sm"
        />
        <button class="btn" @click="startAutopilot">Go</button>
        <button
          class="btn text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
          @click="stopAutopilot"
        >
          Stop Go
        </button>
      </div>
      <p class="text-xs text-slate-600">Status: {{ autopilotStatus }}</p>
    </div>
  </div>
</template>

<script>
import ROSLIB from "roslib";
import { useRobotStore } from "../stores/store";

// simple joystick mapped with Konva; publishes /cmd_vel and can optionally
// move the UI robot locally when odom is unavailable
const MAX_LINEAR = 60.0; // scaled 100x
const MAX_ANGULAR = 120.0; // scaled 100x
const UI_SCALE = 50; // pixel per m for local simulation
const FIELD_HEIGHT = 716;
const OFFSET = 40;
const FIELD_WIDTH = 1016;
const WORLD_X_MAX = FIELD_HEIGHT - 2 * OFFSET; // vertical span
const WORLD_Y_MAX = FIELD_WIDTH - 2 * OFFSET; // horizontal span
const YAW_DEADBAND = 0.0; // rad, force zero omega at start if aligned

export default {
  setup() {
    const ROBOT_STATE = useRobotStore();
    return { ROBOT_STATE };
  },
  watch: {
    simulateUi() {
      // re-seed simulated pose from the latest store pose when toggling
      this.localPoseInitialized = false;
    },
  },
  data() {
    return {
      ros: null,
      cmdVelPublisher: null,
      stageSize: { width: 220, height: 220 },
      center: { x: 110, y: 110 },
      baseRadius: 80,
      knobRadius: 30,
      knob: { x: 110, y: 110 },
      thetaStageSize: { width: 160, height: 160 },
      thetaCenter: { x: 80, y: 80 },
      thetaBaseRadius: 60,
      thetaKnobRadius: 22,
      thetaKnob: { x: 80, y: 80 },
      vel: { vx: 0, vy: 0, omega: 0 },
      worldVel: { vx: 0, vy: 0 },
      worldPose: { x: 0, y: 0, yaw: 0 },
      localPoseInitialized: false,
      anim: null,
      publishAccumulator: 0,
      simulateUi: false,
      goalX: 0,
      goalY: 0,
      autopilotActive: false,
      autopilotStatus: "Idle",
      autopilotGoal: { x: 0, y: 0 },
      arrivalRadius: 0.05,
      kpLin: 0.5,
      kpAng: 1.2,
    };
  },
  mounted() {
    this.initRos();
    this.startAnim();
  },
  beforeUnmount() {
    this.stopAnim();
    if (this.cmdVelPublisher) {
      this.cmdVelPublisher.unadvertise();
    }
    if (this.ros) {
      this.ros.close();
    }
  },
  methods: {
    initRos() {
      this.ros = new ROSLIB.Ros({
        url: "ws://localhost:9090",
      });

      this.cmdVelPublisher = new ROSLIB.Topic({
        ros: this.ros,
        name: "/konva_cmd_vel",
        messageType: "geometry_msgs/msg/Twist",
      });

      this.odomPublisher = new ROSLIB.Topic({
        ros: this.ros,
        name: "/konva_odom",
        messageType: "nav_msgs/msg/Odometry",
      });
    },
    startAnim() {
      const self = this;
      this.anim = new Konva.Animation(function (frame) {
        const dt = (frame?.timeDiff || 0) / 1000;
        if (!dt) return;

        if (self.autopilotActive) {
          self.updateAutopilot(dt);
        }

        // only simulate pose + publish dummy odom when explicitly enabled
        if (self.simulateUi) {
          self.integratePose(dt);
        }

        // throttle publish to ~20 Hz
        self.publishAccumulator += dt;
        if (self.publishAccumulator >= 0.05) {
          self.publishAccumulator = 0;
          self.publishVelocity();
        }
      });

      this.anim.start();
    },
    stopAnim() {
      if (this.anim) {
        this.anim.stop();
      }
    },
    handleDrag(e) {
      const pos = e.target.position();
      const dx = pos.x - this.center.x;
      const dy = pos.y - this.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // clamp to base circle
      let clampedX = dx;
      let clampedY = dy;
      if (dist > this.baseRadius) {
        const scale = this.baseRadius / dist;
        clampedX = dx * scale;
        clampedY = dy * scale;
        e.target.position({
          x: this.center.x + clampedX,
          y: this.center.y + clampedY,
        });
      }

      this.knob.x = this.center.x + clampedX;
      this.knob.y = this.center.y + clampedY;

      // UI axes -> world axes:
      // - up/down controls world X (up = +X)
      // - left/right controls world Y (right = +Y)
      this.vel.vx = (-clampedY / this.baseRadius) * MAX_LINEAR;
      this.vel.vy = (clampedX / this.baseRadius) * MAX_LINEAR;
    },
    resetKnob() {
      this.knob = { ...this.center };
      this.vel = { vx: 0, vy: 0, omega: 0 };
      this.publishVelocity();
    },
    stop() {
      this.resetKnob();
      this.resetThetaKnob();
    },
    nudgeTheta(delta) {
      this.vel.omega = Math.max(-MAX_ANGULAR, Math.min(MAX_ANGULAR, delta));
      this.publishVelocity();
      // zero out knob so linear stops
      this.resetKnob();
      this.resetThetaKnob();
    },
    handleThetaDrag(e) {
      const pos = e.target.position();
      const dx = pos.x - this.thetaCenter.x;
      const dy = pos.y - this.thetaCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let clampedX = dx;
      let clampedY = dy;
      if (dist > this.thetaBaseRadius) {
        const scale = this.thetaBaseRadius / dist;
        clampedX = dx * scale;
        clampedY = dy * scale;
        e.target.position({
          x: this.thetaCenter.x + clampedX,
          y: this.thetaCenter.y + clampedY,
        });
      }

      this.thetaKnob.x = this.thetaCenter.x + clampedX;
      this.thetaKnob.y = this.thetaCenter.y + clampedY;

      // only horizontal movement controls omega
      this.vel.omega = (clampedX / this.thetaBaseRadius) * MAX_ANGULAR;
    },
    resetThetaKnob() {
      this.thetaKnob = { ...this.thetaCenter };
      this.vel.omega = 0;
      this.publishVelocity();
    },
    startAutopilot() {
      if (isNaN(this.goalX) || isNaN(this.goalY)) {
        this.autopilotStatus = "Goal invalid";
        return;
      }
      // clamp goal to map bounds
      const goalX = Math.max(0, Math.min(WORLD_X_MAX, this.goalX));
      const goalY = Math.max(0, Math.min(WORLD_Y_MAX, this.goalY));
      this.goalX = goalX;
      this.goalY = goalY;
      this.autopilotGoal = { x: goalX, y: goalY };
      // expose goal to the UI panel
      this.ROBOT_STATE.bs2pc.tujuan_x = goalX;
      this.ROBOT_STATE.bs2pc.tujuan_y = goalY;
      this.autopilotActive = true;
      this.ROBOT_STATE.utils.autopilot_active = true;
      this.autopilotStatus = `Running to (${goalX}, ${goalY})`;
      const { x, y } = this.worldPosition();
      const yaw = ((this.ROBOT_STATE.dataRobot.pos_theta - 225) * Math.PI) / 180;
      this.worldPose = { x, y, yaw };
      this.localPoseInitialized = true;
      this.resetKnob();
      this.resetThetaKnob();
    },
    stopAutopilot() {
      this.autopilotActive = false;
      this.ROBOT_STATE.utils.autopilot_active = false;
      this.autopilotStatus = "Stopped";
      this.resetKnob();
      this.resetThetaKnob();
      this.worldVel = { vx: 0, vy: 0 };
      this.localPoseInitialized = false;
    },
    updateAutopilot(dt) {
      const { x: currX, y: currY } = this.worldPosition();
      const dx = this.autopilotGoal.x - currX;
      const dy = this.autopilotGoal.y - currY;
      const dist = Math.hypot(dx, dy);

      if (dist < this.arrivalRadius) {
        this.stopAutopilot();
        return;
      }

      // drive along straight-line vector toward the goal (normalized direction)
      const dirX = dx / dist;
      const dirY = dy / dist;
      const speed = Math.min(MAX_LINEAR, Math.max(0.1, this.kpLin * dist));
      const vxWorld = dirX * speed;
      const vyWorld = dirY * speed;
      this.worldVel = { vx: vxWorld, vy: vyWorld };

      // hold heading; no angular command
      const vxBody = vxWorld;
      const vyBody = vyWorld;

      this.vel.vx = Math.max(-MAX_LINEAR, Math.min(MAX_LINEAR, vxBody));
      this.vel.vy = Math.max(-MAX_LINEAR, Math.min(MAX_LINEAR, vyBody));
      this.vel.omega = 0;
    },
    worldPosition() {
      // store uses world coordinates: origin bottom-left
      const rawX = Number(this.ROBOT_STATE.dataRobot.pos_x);
      const rawY = Number(this.ROBOT_STATE.dataRobot.pos_y);
      const worldX = Math.max(0, Math.min(WORLD_X_MAX, Number.isFinite(rawX) ? rawX : 0));
      const worldY = Math.max(0, Math.min(WORLD_Y_MAX, Number.isFinite(rawY) ? rawY : 0));
      const yaw = ((this.ROBOT_STATE.dataRobot.pos_theta - 225) * Math.PI) / 180;
      return { x: worldX, y: worldY, yaw };
    },
    integratePose(dt) {
      if (!this.localPoseInitialized) {
        const { x, y, yaw } = this.worldPosition();
        this.worldPose = { x, y, yaw };
        this.localPoseInitialized = true;
      }

      // choose world velocity source
      let vxW = this.worldVel.vx;
      let vyW = this.worldVel.vy;
      if (!this.autopilotActive) {
        // transform body cmd to world
        const yaw = this.worldPose.yaw;
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        vxW = c * this.vel.vx - s * this.vel.vy;
        vyW = s * this.vel.vx + c * this.vel.vy;
      }

      this.worldPose.x += vxW * dt;
      this.worldPose.y += vyW * dt;
      this.worldPose.yaw += this.vel.omega * dt;

      // keep simulated pose within the map bounds (origin bottom-left)
      this.worldPose.x = Math.max(0, Math.min(WORLD_X_MAX, this.worldPose.x));
      this.worldPose.y = Math.max(0, Math.min(WORLD_Y_MAX, this.worldPose.y));
    },
    publishVelocity() {
      if (!this.cmdVelPublisher) return;

      const twist = new ROSLIB.Message({
        linear: { x: this.vel.vx, y: this.vel.vy, z: 0 },
        angular: { x: 0, y: 0, z: this.vel.omega },
      });

      this.cmdVelPublisher.publish(twist);

      // publish dummy odom so downstream nodes have pose/twist
      const now = Date.now();
      const sec = Math.floor(now / 1000);
      const nanosec = Math.floor((now % 1000) * 1e6);
      const pose = this.localPoseInitialized ? this.worldPose : this.worldPosition();
      // Store/UI axes: +X up, +Y right
      const worldX = pose.x;
      const worldY = pose.y;
      // ROS axes for /odom: +X right, +Y up (swap)
      const odomX = worldY;
      const odomY = worldX;
      const yaw = pose.yaw;
      const qz = Math.sin(yaw / 2);
      const qw = Math.cos(yaw / 2);

      const odom = new ROSLIB.Message({
        header: {
          stamp: { sec, nanosec },
          frame_id: "odom",
        },
        child_frame_id: "base_footprint",
        pose: {
          pose: {
            position: { x: odomX, y: odomY, z: 0 },
            orientation: { x: 0, y: 0, z: qz, w: qw },
          },
          covariance: [
            0.001, 0, 0, 0, 0, 0,
            0, 0.001, 0, 0, 0, 0,
            0, 0, 0.001, 0, 0, 0,
            0, 0, 0, 0.001, 0, 0,
            0, 0, 0, 0, 0.001, 0,
            0, 0, 0, 0, 0, 0.001
          ],
        },
        twist: {
          twist: {
            linear: { x: this.vel.vx, y: this.vel.vy, z: 0 },
            angular: { x: 0, y: 0, z: this.vel.omega },
          },
          covariance: [
            0.001, 0, 0, 0, 0, 0,
            0, 0.001, 0, 0, 0, 0,
            0, 0, 0.001, 0, 0, 0,
            0, 0, 0, 0.001, 0, 0,
            0, 0, 0, 0, 0.001, 0,
            0, 0, 0, 0, 0, 0.001
          ],
        },
      });

      if (this.simulateUi) {
        this.odomPublisher.publish(odom);
      }
    },
  },
};
</script>

<style scoped>
.btn {
  @apply bg-white border border-blue-500 text-blue-500 font-semibold py-2 px-4 rounded transition duration-200 ease-in-out hover:bg-blue-500 hover:text-white;
}
</style>
