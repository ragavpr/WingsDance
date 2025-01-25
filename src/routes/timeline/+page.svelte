<script lang="ts">
	import { onMount } from 'svelte';

	import { GameState } from '$lib/StateManager.svelte';
	import { Buffer } from 'buffer';

	import { TimeLine } from '$lib/timeline.svelte';

	const color: Record<number, number> = {
		0: 0xff3737ff,
		1: 0xffff7f37,
		2: 0xffc3ffc3
	};

	let canvas: HTMLCanvasElement;
	let timeline: TimeLine = $state();

	let files: FileList | undefined = $state();

	let file: Buffer | undefined = $state();

	//TODO: example data -> remove it
	let gs: GameState | undefined = $state();

	$effect(() => {
		if (files && files.length > 0) {
			console.log('READING');
			const reader = new FileReader();
			reader.onload = (ev) => {
				const result = ev.target?.result;
				console.log(result);
				if (result instanceof ArrayBuffer) {
					file = Buffer.from(result);
				}
			};
			reader.readAsArrayBuffer(files[0]);
		}
	});

	onresize = () => {
		canvas.width = Math.min(window.innerWidth, 980);
		timeline?.draw();
	};

	onMount(() => {
		timeline = new TimeLine(canvas);
	});

	function closeFile() {
		files = undefined;
		file = undefined;
		console.log('File closed');
	}

	function process() {
		if (file) {
			gs = new GameState(file!);

			const max_length = Math.ceil(gs.line_pointers[gs.line_pointers.length - 1].time / 10);
			console.log(max_length);
			if (timeline) {
				// this.image = new ImageData(1, 1);
				const image = new ImageData(max_length, 1);
				const data = new Uint32Array(image.data.buffer);
				data.fill(0x88ffffff);

				gs.line_pointers.forEach((msg) => {
					data[Math.floor(msg.time / 10)] = color[msg.dir];
				});
				timeline.image = image;
				timeline.image_scale = 10;
				timeline.target_scale = 0.5;
				timeline.target_position = gs.line_pointers[0].time;
			}
		}
	}
</script>

<nav>
	<button class="file-input-wrapper" onclick={closeFile}>
		{#if file}
			Close
		{:else}
			<input bind:files type="file" accept=".wdcap" /> Select File
		{/if}
	</button>
	<button class="hmm" onclick={process}> Process GS </button>
	<!-- <button class="hmm" onclick={count_messages}> Calc Distribution </button> -->
</nav>
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
		height="80"
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
