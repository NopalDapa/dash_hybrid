import { defineStore } from "pinia";

export const useRobotStore = defineStore("alerts", {
  id: "store",
  state: () => {
    return {
      // all these properties will have their type inferred automatically
      dataRobot: {
        // World coordinates: origin (0,0) at bottom-left
        // X: vertical axis (up), Y: horizontal axis (right)
        pos_x: 0,
        pos_y: 0,
        pos_theta: 225, // spawn rotated 225 deg CCW for the UI
        v_x: 0,
        v_y: 0,
        v_theta: 0,
        bola_x: 0,
        bola_y: 0,
      },
      bs2pc: {
        status: 0,
        tujuan_x: 0,
        tujuan_y: 0,
      },
      utils: {
        publish_switch: false,
        visibility_blueball: false,
        visibility_target: false,
        tempStatus: 0,
        autopilot_active: false,
      },
    };
  },
  actions: {
    // since we rely on `this`, we cannot use an arrow function
    resetDataRobot() {
      this.dataRobot.pos_x = 0;
      this.dataRobot.pos_y = 0;
      this.dataRobot.pos_theta = 225;
      this.dataRobot.v_x = 0;
      this.dataRobot.v_y = 0;
      this.dataRobot.v_theta = 0;
      this.dataRobot.bola_x = 0;
      this.dataRobot.bola_y = 0;
    },
    // randomizeCounter() {
    //   this.count = Math.round(100 * Math.random());
    // },
  },
});
