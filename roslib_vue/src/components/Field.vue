<template>
  <!-- <img src="../assets/Lapangan.png" alt="" srcset="" /> -->
  <div class="flex basis-2/3 border" @click="handleClick">
    <v-stage ref="stage" :config="stageSize">
      <v-layer ref="layer">
        <v-image
          id="parent"
          :config="lapanganConfig"
        />
        <v-image :config="target" />
        <v-image :config="robot" />
      </v-layer>
    </v-stage>
  </div>
</template>

<script>
import LapanganURL from "@/assets/Lapangan.png";
import RobotURL from "@/assets/Model_Robot/canvas.png";
import TargetURL from "@/assets/red_dot-1.png";
import { useRobotStore } from "../stores/store";

// const flex = document.getElementById("parent");
// const rect = flex.getBoundingClientRect();

let field_width = 1016;
let field_height = 716;

export default {
  setup() {
    const ROBOT_STATE = useRobotStore();
    return {
      ROBOT_STATE,
    };
  },
  data() {
    return {
      stageSize: {
        width: field_width,
        height: field_height,
      },
      lapangan: null,
      lapanganConfig: {
        image: null,
        x: 0,
        y: 0,
        width: field_width,
        height: field_height,
      },
      robot: null,
      target: null,

      //init config robot
      RobotConfig: {
        image: null,
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        rotation: 0,
        //get the robot to the right cordinate
        offset: {
          x: 40,
          y: 40,
        },
        // stroke: "red",
      },

      // target visual size for robot (in pixels on the stage)
      robotRenderSize: {
        w: 80,
        h: 80,
      },

      TargetConfig: {
        image: null,
        x: 58,
        y: 58,
        width: 50,
        height: 50,
        offset: {
          x: 25,
          y: 25,
        },
        visible: false,
      },
    };
  },
  mounted() {
    window.addEventListener("keypress", this.handleKeyDown);

    const THAT = this;
    const anim = new Konva.Animation(function (frame) {
      // map world pose (origin bottom-left) to screen (origin top-left)
      // worldX: vertical axis (up), worldY: horizontal axis (right)
      const worldX = Number(THAT.ROBOT_STATE.dataRobot.pos_x) || 0;
      const worldY = Number(THAT.ROBOT_STATE.dataRobot.pos_y) || 0;
      const offsetX = THAT.RobotConfig.offset.x;
      const offsetY = THAT.RobotConfig.offset.y;

      // world(0,0) => screen(offsetX, field_height - offsetY) => bottom-left
      let screenX = offsetX + worldY;
      let screenY = field_height - offsetY - worldX;

      // clamp screen coordinates
      screenX = Math.max(
        offsetX,
        Math.min(field_width - offsetX, screenX)
      );
      screenY = Math.max(
        offsetY,
        Math.min(field_height - offsetY, screenY)
      );

      THAT.RobotConfig.x = screenX;
      THAT.RobotConfig.y = screenY;
      THAT.RobotConfig.rotation =
        (THAT.ROBOT_STATE.dataRobot.pos_theta || 0) * (180 / Math.PI);

      //
      THAT.TargetConfig.visible = THAT.ROBOT_STATE.utils.visibility_target;
      if (THAT.TargetConfig.visible) {
        const goalX = Number(THAT.ROBOT_STATE.bs2pc.tujuan_x) || 0;
        const goalY = Number(THAT.ROBOT_STATE.bs2pc.tujuan_y) || 0;

        const worldXMax = field_height - 2 * offsetY;
        const worldYMax = field_width - 2 * offsetX;
        const clampedGoalX = Math.max(0, Math.min(worldXMax, goalX));
        const clampedGoalY = Math.max(0, Math.min(worldYMax, goalY));

        THAT.TargetConfig.x = offsetX + clampedGoalY;
        THAT.TargetConfig.y = field_height - offsetY - clampedGoalX;
        THAT.target = THAT.TargetConfig;
      }

  // NOTE: keep image instance stable; image is loaded once in `created()`.
  THAT.robot = THAT.RobotConfig;
    });

    anim.start();
  },
  created() {
    const Lapangan = new window.Image();
    Lapangan.src = LapanganURL;
    Lapangan.onload = () => {
      // Scale background to fit stage (contain) so it won't get cropped.
      // Stage is fixed (field_width x field_height).
      const iw = Lapangan.naturalWidth || Lapangan.width;
      const ih = Lapangan.naturalHeight || Lapangan.height;

      // Fallback safety
      if (!iw || !ih) {
        this.lapangan = Lapangan;
        this.lapanganConfig = {
          ...this.lapanganConfig,
          image: Lapangan,
          x: 0,
          y: 0,
          width: field_width,
          height: field_height,
        };
        return;
      }

      const scale = Math.min(field_width / iw, field_height / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = (field_width - w) / 2;
      const y = (field_height - h) / 2;

      this.lapangan = Lapangan;
      this.lapanganConfig = {
        ...this.lapanganConfig,
        image: Lapangan,
        x,
        y,
        width: w,
        height: h,
      };
    };

    // robot image + auto-scale to match reference size
    // We want canvas.png to render the same on-screen size as the old blue.png.
    // Reference dimensions are read from blue.png at runtime.
    const RobotRef = new window.Image();
    RobotRef.src = new URL("../assets/Model_Robot/blue.png", import.meta.url).href;
    RobotRef.onload = () => {
      const rw = RobotRef.naturalWidth || RobotRef.width;
      const rh = RobotRef.naturalHeight || RobotRef.height;
      if (rw && rh) {
        this.robotRenderSize = { w: rw, h: rh };
        this.RobotConfig.width = rw;
        this.RobotConfig.height = rh;
        // keep offset centered
        this.RobotConfig.offset = { x: rw / 2, y: rh / 2 };
      }
    };

    const Robot = new window.Image();
    Robot.src = RobotURL;
    Robot.onload = () => {
      const iw = Robot.naturalWidth || Robot.width;
      const ih = Robot.naturalHeight || Robot.height;
      const tw = this.robotRenderSize.w;
      const th = this.robotRenderSize.h;

      // If the new image file has different intrinsic size, scale it to match
      // the target render size (based on blue.png).
      if (iw && ih && tw && th) {
        this.RobotConfig.width = tw;
        this.RobotConfig.height = th;
        this.RobotConfig.offset = { x: tw / 2, y: th / 2 };
      }

      this.RobotConfig.image = Robot;
      this.robot = this.RobotConfig;
    };

    //target
    const Target = new window.Image();
    Target.src = TargetURL;
    this.TargetConfig.image = Target;

    //deploy Target
    this.target = this.TargetConfig;

  },
  methods: {
    fieldPosition(realPos) {
      return realPos + this.padding;
    },
    handleKeyDown(event) {
      const key = event.key.toLowerCase();
      const offsetX = this.RobotConfig.offset.x;
      const offsetY = this.RobotConfig.offset.y;
      const worldXMax = field_height - 2 * offsetY;
      const worldYMax = field_width - 2 * offsetX;

      switch (key) {
        case "w":
          this.ROBOT_STATE.dataRobot.pos_x = Math.min(
            worldXMax,
            this.ROBOT_STATE.dataRobot.pos_x + 5
          );
          break;
        case "a":
          this.ROBOT_STATE.dataRobot.pos_y = Math.max(
            0,
            this.ROBOT_STATE.dataRobot.pos_y - 5
          );
          break;
        case "s":
          this.ROBOT_STATE.dataRobot.pos_x = Math.max(
            0,
            this.ROBOT_STATE.dataRobot.pos_x - 5
          );
          break;
        case "d":
          this.ROBOT_STATE.dataRobot.pos_y = Math.min(
            worldYMax,
            this.ROBOT_STATE.dataRobot.pos_y + 5
          );
          break;
        case "0":
          this.ROBOT_STATE.dataRobot.pos_theta += 5;
          break;
        case "9":
          this.ROBOT_STATE.dataRobot.pos_theta -= 5;
          break;
        default:
          break;
      }
    },
    handleClick(event) {
      if (this.ROBOT_STATE.utils.tempStatus == 3) {
        console.log(this.ROBOT_STATE.utils);
        const offsetX = this.RobotConfig.offset.x;
        const offsetY = this.RobotConfig.offset.y;

        // Convert screen coords (origin top-left) -> world coords (origin bottom-left)
        const clickX = event.offsetX;
        const clickY = event.offsetY;
        const worldXMax = field_height - 2 * offsetY;
        const worldYMax = field_width - 2 * offsetX;
        const worldX = field_height - clickY - offsetY;
        const worldY = clickX - offsetX;

        const clampedWorldX = Math.max(0, Math.min(worldXMax, worldX));
        const clampedWorldY = Math.max(0, Math.min(worldYMax, worldY));
        console.log(
          `Clicked at world coordinates: X=${clampedWorldX}, Y=${clampedWorldY}`
        );

        this.ROBOT_STATE.bs2pc.tujuan_x = clampedWorldX;
        this.ROBOT_STATE.bs2pc.tujuan_y = clampedWorldY;

        // render target using the same world->screen mapping as the robot
        this.TargetConfig.x = offsetX + clampedWorldY;
        this.TargetConfig.y = field_height - offsetY - clampedWorldX;
        // console.log(event);
        // Lakukan sesuatu dengan koordinat yang didapatkan
      }
    },
  },
};
</script>
