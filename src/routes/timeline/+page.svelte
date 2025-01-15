<script lang="ts">
  import { onMount } from 'svelte';
  import { TimeLine } from '$lib/timeline.svelte';

  let canvas: HTMLCanvasElement;
  let timeline: TimeLine;

  onMount(() => {
    timeline = new TimeLine(canvas);
  })

  onresize = () => {
    canvas.width = Math.min(window.innerWidth, 980);
    timeline?.draw();
  }
</script>

<div id="timeline">
  <canvas
    bind:this={canvas}
    onmousedown={timeline.handleMouseDown.bind(timeline)}
    onmouseup={timeline.handleMouseUp.bind(timeline)}
    onmouseleave={timeline.handleMouseUp.bind(timeline)}
    onmousemove={timeline.handleMouseMove.bind(timeline)}
    onwheel={timeline.handleScroll.bind(timeline)}
    ontouchstart={timeline.handleTouchStart.bind(timeline)}
    ontouchmove={timeline.handleTouchMove.bind(timeline)}
    ontouchend={timeline.handleTouchEnd.bind(timeline)}

    width={Math.min(window.innerWidth, 980)}
    height=80
  ></canvas>
</div>

<div>
  <p>position: {timeline?.position}</p>
  <p>scale: {timeline?.scale}</p>
  <p>velocity: {timeline?.velocity_position}</p>
  <p>targetPosition: {timeline?.target_position}</p>
  <p>targetScale: {timeline?.target_scale}</p>

</div>

<style>
  #timeline {
    position: absolute;
    width: 100%;
    display: flex;
    justify-content: center;
    bottom: 0;
  }
  canvas {
    background-color: gray;
    touch-action: none; /* Prevent default touch actions */
    /* position: absolute; */
    /* bottom: 20px; */
    /* width: 100%; */
    /* max-width: 980px; */
  }
</style>