<template>
  <div class="basis-1/3">
    <div class="p-5 space-y-4">
      <div>
        <p><strong> STATUS : DISCONNECT</strong></p>
        <p>IP LAPTOP: 192.168.1.1</p>
        <p class="text-green-800">
          Running Status : {{ ROBOT_STATE.bs2pc.status }}
        </p>
      </div>

      <div>
        <p class="text-green-600"><strong>POSISI</strong></p>
        <div class="px-5">
          <p>Posisi X : {{ ROBOT_STATE.dataRobot.pos_x }}</p>
          <p>Posisi Y : {{ ROBOT_STATE.dataRobot.pos_y }}</p>
          <p>Posisi Theta : {{ ROBOT_STATE.dataRobot.pos_theta }}</p>
        </div>
      </div>

      <div>
        <p class="text-green-600"><strong>KECEPATAN</strong></p>
        <div class="px-5">
          <p>Kecepatan X : {{ ROBOT_STATE.dataRobot.v_x }}</p>
          <p>Kecepatan Y : {{ ROBOT_STATE.dataRobot.v_y }}</p>
          <p>Kecepatan Theta : {{ ROBOT_STATE.dataRobot.v_theta }}</p>
        </div>
      </div>

      <div>
        <p class="text-green-600"><strong>POSISI</strong></p>
        <div class="px-5">
          <p>X Tujuan : {{ ROBOT_STATE.bs2pc.tujuan_x }}</p>
          <p>Y Tujuan : {{ ROBOT_STATE.bs2pc.tujuan_y }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useKonvaRobotStore } from "../../stores/konvaRobot";

export default {
  setup() {
    const ROBOT_STATE = useKonvaRobotStore();
    return { ROBOT_STATE };
  },
};
</script>
