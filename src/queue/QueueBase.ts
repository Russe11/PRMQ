// Copyright (c) 2017 Russell Lewis (russlewis@gmail.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * PRMQ Queues
 */

import {ConsumeThen} from '../helpers/ConsumeThen';
import {Message, Options, Replies} from 'amqplib';
import {ExchangeBase} from '../exchange/ExchangeBase';
import AssertQueue = Replies.AssertQueue;

export class QueueBase implements Promise<any> {

  private resolveSelf: any;
  private rejectSelf: any;
  public thenOff: any;

  public resolve(val: any) { this.resolveSelf(val); }
  public reject(reason: any) { this.rejectSelf(reason); }

  public shouldAssert: boolean = false;
  public consumers: any[] = [];
  public binds: any[] = [];
  public q: AssertQueue;

  constructor(
    public promise: Promise<any>,
    public ch: any,
    public queueName: string,
    public options: Options.AssertQueue = {},
    assert: boolean = true
  ) {
    if (assert) {
      this.assert();
    }
  }

  public results: any = {
    send: []
  };

  public logResults: boolean;

  public getQueueName() {
    return this.queueName;
  }

  /**
   * Queue was created with option { durable: true }
   */
  public isDurable() {
    return this.options && this.options.durable === true;
  }

  /**
   * Check if a queue exists
   */
  public async check() {
    await this.ch.checkQueue(this.queueName);
  }

  /**
   * Assert a queue - Channel#assertQueue
   */
  public assert() {
    this.promise = this.promise
      .then(() => {
        return this.ch.assertQueue(this.queueName, this.options);
      })
      .then((q) => {
        this.q = q;
        this.queueName = q.queue;
      });

    return this;
  }

  public bind(exchange: ExchangeBase) {

    this.promise = this.promise
      .then(() => exchange)
      .then(() => {
        return this.ch.bindQueue(this.q.queue, exchange.exchangeName);
      });

    return this;
  }

  public bindWithRouting(exchange: ExchangeBase, routing: string) {
    this.promise = this.promise
      .then(() => exchange)
      .then(() => {
        return this.ch.bindQueue(this.q.queue, exchange.exchangeName, routing);
      });
    return this;
  }

  public bindWithRoutings(exchange: ExchangeBase, routings: string[]) {
    this.promise = this.promise.then(() => exchange);
    routings.forEach((routing) => {
      this.promise = this.promise.then(() => {
        return this.ch.bindQueue(this.q.queue, exchange.exchangeName, routing);
      });
    });
    return this;
  }

  public consume(callbackFn: (msg: any) => void) {
    this.promise = this.promise.then(() => {
      return this.ch.consume(this.q.queue, (msg) => {
        if (msg !== null) {
          const content = msg.content.toString();
          callbackFn(content.startsWith('{') ? JSON.parse(content) : content);
        }
      }, { noAck: true });
    });
    return this;
  }

  public consumeRaw(callbackFn: (msg: Message) => void) {

    this.promise = this.promise.then(() => {
      return this.ch.consume(this.q.queue, callbackFn, { noAck: true });
    });
    return this;
  }

  public consumeWithAck(callbackFn: (msg: any, then: ConsumeThen) => void) {
    this.promise = this.promise.then(() => {
      return this.ch.consume(this.q.queue, (msg) => {
        if (msg !== null) {
          const content = msg.content.toString();
          callbackFn(
            content.startsWith('{') ? JSON.parse(content) : content,
            new ConsumeThen(this.ch, msg)
          );
        }
      }, { noAck: false });
    });
    return this;
  }

  public consumeRawWithAck(callbackFn: (msg: Message, then: ConsumeThen) => void) {
    this.promise = this.promise.then(() => {
      return this.ch.consume(this.q.queue, msg => callbackFn(msg , new ConsumeThen(this.ch, msg)), { noAck: false });
    });
    return this;
  }

  public [Symbol.toStringTag]: any;

  public then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) =>
      TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) =>
      TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(() => {
      this.thenOff = this.then;
      this.then = null;
      return this;
    }).then(onfulfilled, onrejected);
  }

  // tslint:disable-next-line:no-reserved-keywords
  public catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<any | TResult> {
    return this.promise.then(onrejected);
  }

  /**
   * Channel Prefetch - channel#prefetch
   */
  public async prefetch(count: number) {
    await this.ch.prefetch(count);
    return this;
  }

}
