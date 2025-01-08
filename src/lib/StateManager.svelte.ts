import { Buffer } from 'buffer';
import { MessageParser } from './MessageParser';
import * as TP from '$lib/ReWings/lib/types';
// import { createHash } from 'crypto';
import { dir_type, msg_type } from './MessageParser';
import _ from 'lodash';
import { browser } from '$app/environment';

export class GameState {
	planes: Record<number, TP.Plane[]> = {};
	missiles: Record<number, TP.Missile[]> = {};
	specialEntities: Record<number, TP.SpecialEntity[]> = {};

	#keyframes: { time: number; pt: number }[] = []; //1.1s
	#sub_keyframes: { time: number; pt: number }[] = []; //100ms x10

	#debug_messages: any[] = [];

	keyframe_mean?: number;
	keyframe_sd?: number;

	client_info!: Record<string, string>;
	server_info!: Record<string, string>;

	start_time_utc!: Date;
	start_time!: number;

	end_time_utc!: Date;
	end_time!: number;

	checksum?: Buffer;
	integritous?: boolean = $state();

	data: Buffer;

	constructor(data: Buffer) {
		this.data = data;

		let pt = 0;
		let s_time = undefined;
		while (pt < this.data.length) {
			const dir = this.data.readUInt8(pt + 4);
			const type = this.data.readUint8(pt + 7);
			if (dir == 0 && type == 0xa9) {
				if (s_time === undefined) s_time = this.data.readUInt32BE(pt);
				else s_time += 1092.0401854714064;
				this.#keyframes.push({ time: this.data.readUInt32BE(pt), pt });
			}
			if (!(this.start_time && this.start_time_utc) && dir == 2 && type == 0x41) {
				this.start_time = this.data.readUInt32BE(pt);
				const { timestamp_start, client_info } = MessageParser.parseInfoMessage(
					this.#getSubBuffer(pt)
				);
				this.start_time_utc = new Date(Number(timestamp_start as bigint));
				this.client_info = client_info;
			}
			if (!(this.end_time && this.end_time_utc) && dir == 2 && type == 0x49) {
				this.end_time = this.data.readUInt32BE(pt);
				const { timestamp_stop } = MessageParser.parseInfoMessage(this.#getSubBuffer(pt));
				this.end_time_utc = new Date(Number(timestamp_stop as bigint));
			}
			if (!this.server_info && dir == 2 && type == 0x42) {
				const { server_info } = MessageParser.parseInfoMessage(this.#getSubBuffer(pt));
				this.server_info = server_info;
			}

			// if([0x10, 0x11, 0x12, 0x13, 0x14, 0x16, 0x17, 0x15].includes(type)) {
			if ([0xa2].includes(type)) {
				const msg = MessageParser.parseReceivedMessage(this.#getSubBuffer(pt));
				this.#debug_messages.push({
					...msg,
					_type: type,
					_type_info: msg_type[0][type],
					_time: data.readUInt32BE(pt)
				});
			}

			pt = this.#ptNextMessage(pt);
		}
		pt = this.data.byteLength - 40;
		if (this.data.readUInt8(pt + 7) == 0x40 && this.data.readUInt16BE(pt + 5) == 33) {
			this.checksum = this.data.subarray(pt + 8, pt + 40);
		}

		// this.keyframe_interval = (this.keyframes.at(-1)!.c_time - this.keyframes.at(0)!.c_time) / (this.keyframes.length - 1)

		// console.log(this)
		// this.calculate_time_variations_rolling()
		// const a = this.#get_nearest_keyframe(3026)
		// console.log(this.#keyframes[a])

		// console.log(this.start_time_utc)
		// console.log(this.#debug_messages[0].planes)
	}

	#ptNextMessage(pt: number) {
		return pt + 7 + this.data.readUInt16BE(pt + 5);
	}

	#getSubBuffer(pt: number) {
		return this.data.subarray(pt + 7, this.#ptNextMessage(pt));
	}

	#populate_sub_keyframes(keyframe_pt: number) {
		this.#sub_keyframes = [];
		let pt = this.#ptNextMessage(keyframe_pt);
		while (true) {
			const dir = this.data.readUInt8(pt + 4);
			const type = this.data.readUint8(pt + 7);
			if (dir == 0 && type == 0xa9) {
				break;
			}
			if (dir == 0 && type == 0xa3) {
				this.#sub_keyframes.push({ time: this.data.readUInt32BE(pt), pt });
			}
			pt = this.#ptNextMessage(pt);
		}
	}

	#get_nearest_keyframe(time: number) {}

	calculate_time_variations_rolling(start_time: number, end_time: number) {
		const differences = _.zipWith(
			this.#keyframes.slice(1),
			this.#keyframes.slice(0, -1),
			(a, b) => a.time - b.time
		);

		const mean = _.mean(differences);

		const sd = Math.sqrt(
			_.sum(_.map(differences, (i) => Math.pow(i - mean, 2))) / differences.length
		);

		console.log({ mean, sd });
	}

	async verify_integrity() {
		if (this.integritous !== undefined) {
			console.warn('Already checked for integritry once');
			return;
		}
		if (!this.checksum) {
			console.warn('No checksum present');
			return;
		}
		console.log('Verifying integrity', this.integritous);
		this.integritous =
			this.checksum.compare(
				browser
					? Buffer.from(
							await window.crypto.subtle.digest(
								'SHA-256',
								this.data.subarray(0, this.data.byteLength - 40)
							)
						)
					: (await import('crypto'))
							.createHash('sha256')
							.update(this.data.subarray(0, this.data.byteLength - 40))
							.digest()
			) == 0;
		console.log('Verifying integrity', this.integritous);
	}
}

export function parseMessage(buffer: Buffer, offset: number) {
	const time = buffer.readUInt32BE(offset);
	const dir = buffer.readUInt8(offset + 4);
	const len = buffer.readUInt16BE(offset + 5);
	// const message = Buffer.from(new Uint8Array(data.subarray(offset+7, offset+7+len)));
	const message = buffer.subarray(offset + 7, offset + 7 + len);
	const type = buffer.readUInt8(offset + 7);
	const result =
		dir == 0
			? MessageParser.parseReceivedMessage(message)
			: dir == 1
				? MessageParser.parseSentMessage(message)
				: dir == 2
					? MessageParser.parseInfoMessage(message)
					: console.error('Unknown dir type', dir, type.toString(16));
	result.__type_info = msg_type[dir][type];
	result.__type = type.toString(16);
	result.__time = time;
	result.__dir = dir;
	return result;
}

export function fileCalcDistribution(data: Buffer) {
	const distribution: Record<number, Record<number, { count: number; info: string }>> = {};
	Object.keys(dir_type).forEach((dir) => {
		const ndir = parseInt(dir);
		distribution[ndir] ??= {};
		Object.keys(msg_type[ndir]).forEach((type) => {
			const ntype = parseInt(type);
			distribution[ndir][ntype] = {
				count: 0,
				info: msg_type[ndir][ntype]
			};
		});
	});
	const size = data.byteLength;
	let offset = 0;
	let sample = 0;
	let line = 0;

	while (offset < size) {
		line++;
		const dir = data.readUInt8(offset + 4);
		// const time = data.readBigInt64BE(offset+1);
		const len = data.readUInt16BE(offset + 5);
		if (len + 7 > size) {
			throw new Error('Invalid length');
		}
		const type = data.readUInt8(offset + 7);
		// const message = data.subarray(offset+11, offset+11+len);
		if (sample > 0 && type == 0xa3) {
			const len = data.readUInt16BE(offset + 5);
			console.log(line, data.subarray(offset + 7, offset + 7 + len).toString('hex'));
			sample--;
		}
		distribution[dir][type].count++;
		offset += len + 7;
	}
	if (offset != size) {
		console.error('EOF not reached correctly', offset, size);
	}
	console.log(distribution);
}

export function fileParseFindLine(data: Buffer, line: number) {
	const size = data.byteLength;
	let offset = 0;
	if (line < 1) line = 1;
	while (offset < size && --line) {
		const len = data.readUInt16BE(offset + 5);
		offset += len + 7;
	}
	if (offset >= size) {
		throw new Error('File EOF reached');
	}
	// console.log(offset)
	const len = data.readUInt16BE(offset + 5);
	try {
		const result = parseMessage(data, offset);
		console.log(
			offset,
			data.subarray(offset + 7, offset + 7 + len),
			data.readInt16BE(offset + 5),
			JSON.stringify(result, null, 2)
		);
	} catch (e: any) {
		console.error('Error', e, data.subarray(offset, offset + len).toString('hex'));
	}
}

export function fileParseAll(data: Buffer, print_type?: number, limit: number = 100) {
	const size = data.byteLength;
	let offset = 0;
	let line = 0;
	if (limit < 1) limit = 1;
	while (limit-- && offset < size) {
		line++;
		const time = data.readUInt32BE(offset);
		const dir = data.readUInt8(offset + 4);
		const len = data.readUInt16BE(offset + 5);
		if (len + 7 > size) {
			throw new Error('Invalid length');
		}
		const message = Buffer.from(new Uint8Array(data.subarray(offset + 7, offset + 7 + len)));
		const type = data.readUint8(offset + 7);
		try {
			const result = parseMessage(data, offset);
			if (print_type == type) {
				// console.log(result);
				return result;
			} else {
				if (result.type == type) console.log(line, time, offset, len, result.__type_info);
			}
		} catch (e: any) {
			console.error(line, e.message);
			if (e.message.search('Unexpected message length') < 0) {
				console.log('Message', message.toString('hex'));
				return;
			}
		}
		offset += len + 7;
	}
}

// export function fileVerifyIntegrity(data: Buffer) {
// 	const size = data.byteLength;
// 	const offset = size - 40;

// 	const type = data.readUInt8(offset + 7);
// 	const to_verify = data.subarray(0, offset);
// 	const checksum = data.subarray(offset + 8, offset + 40);
// 	if (type != 0x40 || data.readUInt16BE(offset + 5) != 33) throw new Error('Checksum not preset');
// 	const result = createHash('sha256').update(to_verify).digest();

// }
