import {
	MessageParser as WingsMessageParser,
	msg_type as wings_msg_type
} from '$lib/ReWings/lib/MessageParser';
import { ServersInfo } from '$lib/ReWings/lib/ServerInfo';
import { Buffer } from 'buffer';
import { Parser } from 'binary-parser';

export const dir_type: Record<number, string> = {
	0: 'Received',
	1: 'Sent',
	2: 'Custom'
};
export const msg_type: Record<number, Record<number, string>> = {
	...wings_msg_type,
	2: {
		0x41: 'Recording Started, ClientInfo',
		0x42: 'ServerInfo',
		0x45: 'ScreenInfo-Relative',
		0x46: 'ScreenInfo-Absolute',
		0x49: 'Recording Stopped',
		0x40: 'Checksum Hash'
	}
};

export class MessageParser {
	static parseReceivedMessage(buffer: Buffer) {
		return WingsMessageParser.parseReceivedMessage(buffer);
	}
	static parseSentMessage(buffer: Buffer) {
		return WingsMessageParser.parseSentMessage(buffer);
	}
	static parseInfoMessage(buffer: Buffer) {
		let result;
		const type = buffer.readUInt8(0);
		const parser = new Parser().endianness('big').seek(1);
		switch (type) {
			case 0x41:
				result = parser
					.uint64('timestamp_start')
					.uint16be('DEL__length')
					.string('client_info', {
						length: 'DEL__length',
						formatter: (x) => JSON.parse(x)
					})
					.saveOffset('DEL_final_offset')
					.parse(buffer);
				delete result.DEL__length;
				break;
			case 0x42:
				result = parser
					.uint16('DEL__length')
					.string('server_info', {
						length: 'DEL__length',
						formatter: (x) => ServersInfo.parseServerString(x)
					})
					.saveOffset('DEL_final_offset')
					.parse(buffer);

				delete result.DEL__length;
				break;
			case 0x45:
				result = parser
					.uint16('canvas_width')
					.uint16('canvas_height')
					.floatbe('zoom')
					.uint32('following_player_id')
					.saveOffset('DEL_final_offset')
					.parse(buffer);
				break;
			case 0x46:
				result = parser
					.uint16('canvas_width')
					.uint16('canvas_height')
					.floatbe('zoom')
					.int32('anchor_x')
					.int32('anchor_y')
					.saveOffset('DEL_final_offset')
					.parse(buffer);
				break;
			case 0x49:
				result = parser.uint64('timestamp_stop').saveOffset('DEL_final_offset').parse(buffer);
				break;
			case 0x40:
				result = parser
					.array('checksum', {
						type: 'uint8',
						length: 32
					})
					.saveOffset('DEL_final_offset')
					.parse(buffer);
				break;
		}
		if (result == undefined) throw new Error(`Unknown message type received ${type}`);
		result.__type_info = msg_type[2][type];
		const remaining = buffer.byteLength - result.DEL_final_offset;
		if (remaining)
			throw new Error(`${type} Unexpected message length, ${remaining} bytes remaining`);
		delete result.DEL_final_offset;
		return result;
	}
}
