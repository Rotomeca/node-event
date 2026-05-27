import { Func, MayBe, Nullable, pipe, zip } from '@rotomeca/utils';
import { AEventHandler } from '../abstract/AEventHandler';
import { IEventHandler } from '../interfaces/IEventHandler';
import {
	EventCallResult,
	HandlerAddedCallback,
	HandlerRemovedCallback,
	HandlerClearedCallback,
} from '../utils/types';
import { EventDelegate } from './EventHandler';

export class JsEvent<TCallback extends Func = Func> extends AEventHandler<
	any[],
	TCallback
> {
	#_toObject<A extends string = string, B extends Func = TCallback>(
		array: [A, B][],
	): Record<A, B> {
		let record: Record<A, B> = {} as Record<A, B>;
		for (const [key, value] of array) {
			record[key] = value;
		}

		return record;
	}

	invoke(...args: any[]): EventCallResult<TCallback> {
		let event = new EventDelegate<TCallback>();
		for (const element of pipe(zip(this.keys, this.getInvocationList()), x =>
			this.#_toObject(x),
		)) {
		}
	}
	call<TResult = ReturnType<TCallback>>(
		...args: any[]
	): Nullable<TResult | TResult[]> {
		const result = this.invoke(...args);

		switch (key) {
			case value:
				break;

			default:
				break;
		}
	}
	protected _p_initOnHandlerAdded(): IEventHandler<
		[key: string, callbackAdded: TCallback],
		HandlerAddedCallback<any[], TCallback>,
		EventCallResult<HandlerAddedCallback<any[], TCallback>>
	> {
		throw new Error('Method not implemented.');
	}
	protected _p_initOnHandlerRemoved(): IEventHandler<
		[key: string, callbackRemoved: MayBe<TCallback>],
		HandlerRemovedCallback<any[], TCallback>,
		EventCallResult<HandlerRemovedCallback<any[], TCallback>>
	> {
		throw new Error('Method not implemented.');
	}
	protected _p_initOnHandlerCleared(): IEventHandler<
		[callbacksCleared: TCallback[]],
		HandlerClearedCallback<any[], TCallback>,
		EventCallResult<HandlerClearedCallback<any[], TCallback>>
	> {
		throw new Error('Method not implemented.');
	}
	constructor() {
		super();
	}
}
