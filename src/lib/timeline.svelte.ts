export class TimeLine {
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	frame_request_stub?: number | void;

	smoothness: number = 0.1;
	friction: number = 0.1;

	position: number = $state(100);
	target_position: number = $state(0);
	velocity_position: number = $state(0);

	scale: number = $state(1); // 1 inch = 1 minute
	target_scale: number = $state(10);
	// velocity_scale: number = $state(0);

	image!: ImageData = $state(new ImageData(1, 1));
	image_scale = 1;
	#image_element!: ImageBitmap;

	#is_held: boolean = false;
	#hold_start_position: number = 0;

	#last_frame_time: number = 0;
	#last_input_time: number = 0;

	#last_touch_distance: number = 0;

	playing = true;

	constructor(canvas: HTMLCanvasElement) {
		$effect(() => {
			const _ =
				this.position +
				this.velocity_position +
				this.target_position +
				this.scale +
				this.target_scale;
			if (this.image);
			this.frame_request_stub &&= cancelAnimationFrame(this.frame_request_stub);
			this.frame_request_stub = requestAnimationFrame(this.fixed_update.bind(this));
		});

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;

		$effect(() => {
			window.createImageBitmap(this.image).then((image) => {
				this.#image_element = image;
			});
		});

		// this.image = new ImageData(1, 1);
		const image = new ImageData(300, 1);
		const data = new Uint32Array(image.data.buffer);

		// Little Endian
		data[0] = 0xff0000ff; // red
		data[1] = 0xff00ff00; // green
		data[2] = 0xffff0000; // blue
		for (let i = 3; i < 300; i += 3) {
			data.copyWithin(i, 0, 3);
		}

		this.image = image;
	}

	fixed_update() {
		// let changed = false;
		const current_frame_time = Date.now();

		// this.target_position = Math.round(this.target_position);

		if (this.target_position < 0) {
			this.target_position = 0;
			this.velocity_position = 0;
		} else if (this.target_position > this.image.width * this.image_scale) {
			this.target_position = this.image.width * this.image_scale;
			this.velocity_position = 0;
		}

		// console.log(Date.now())

		const dT = (current_frame_time - this.#last_frame_time) * 0.001;
		const dX = (this.target_position - this.position) * this.smoothness;
		const dS = (this.target_scale - this.scale) * this.smoothness;

		if (this.playing) this.target_position += dT * 1000;

		if (!this.#is_held) {
			if (Math.abs(this.velocity_position) > 0.1) {
				this.velocity_position *= 1 - this.friction;
				this.target_position += this.velocity_position * dT;
			} else {
				this.velocity_position = 0;
			}
		} else {
			// this.velocity_position = 0;
		}
		if (this.target_position != this.position) {
			if (Math.abs(dX) > 0.002) {
				this.position += dX;
			} else {
				this.position = this.target_position;
			}
		}
		if (this.target_scale != this.scale) {
			if (Math.abs(dS) > 0.002) {
				this.scale += dS;
			} else {
				this.scale = this.target_scale;
			}
		}

		this.#last_frame_time = current_frame_time;
		this.draw();
	}

	handleMouseDown(event: MouseEvent) {
		const mX = (this.canvas.width * 0.5 + event.clientX) / this.scale;
		this.#is_held = true;
		this.#hold_start_position = mX + this.target_position;
		this.#last_input_time = Date.now();
	}

	handleMouseUp(event: MouseEvent) {
		this.#is_held = false;
	}

	handleMouseMove(event: MouseEvent) {
		if (this.#is_held) {
			const current_input_time = Date.now();
			const dT = current_input_time - this.#last_input_time;

			const mX = this.canvas.width * 0.5 + event.clientX;
			const old_target_position = this.target_position;
			this.target_position = this.#hold_start_position - mX / this.scale;
			this.velocity_position = (this.target_position - old_target_position) * dT * this.scale;
			this.#last_input_time = current_input_time;
		}
	}

	handleTouchStart(event: TouchEvent) {
		if (event.touches.length === 1) {
			this.handleMouseDown(event.touches[0]);
		} else if (event.touches.length === 2) {
			this.#last_touch_distance = this.getTouchDistance(event.touches);
		}
	}

	handleTouchEnd(event: TouchEvent) {
		this.handleMouseUp(event);
	}

	handleTouchMove(event: TouchEvent) {
		if (event.touches.length === 1) {
			this.handleMouseMove(event.touches[0]);
		} else if (event.touches.length === 2) {
			const currentTouchDistance = this.getTouchDistance(event.touches);
			const deltaDistance = currentTouchDistance - this.#last_touch_distance;
			this.target_scale += deltaDistance / this.scale;
			this.target_scale = Math.max(
				1 / this.image_scale,
				Math.min(this.target_scale, 20 / this.image_scale)
			); // Limit the scale
			this.#last_touch_distance = currentTouchDistance;
		}
	}

	handleScroll(event: WheelEvent) {
		this.target_scale = Math.max(
			1 / this.image_scale,
			Math.min(this.target_scale + (event.deltaY * -0.1) / this.image_scale, 20 / this.image_scale)
		);
	}

	getTouchDistance(touches: TouchList) {
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	draw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();

		this.ctx.imageSmoothingEnabled = false;
		this.ctx.drawImage(
			this.#image_element,
			// 0, 0, //TODO: Implement Clipping
			// 3, 1,
			-this.position * this.scale + this.canvas.width / 2,
			40,
			this.scale * this.image_scale * this.image.width,
			this.canvas.height
		);

		// Draw a line at the center of the canvas
		this.ctx.beginPath();
		this.ctx.moveTo(this.canvas.width / 2, 0);
		this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
		this.ctx.strokeStyle = 'black'; // Change the color to your preference
		this.ctx.stroke();

		this.ctx.restore();
	}
}
