/* eslint-disable no-unused-vars,no-console,import/no-extraneous-dependencies,padded-blocks */
const P = require('bluebird');
const {expect} = require('chai');
const PRMQ = require('./index');

const prmq = new PRMQ('amqp://localhost');

describe('Examples', () => {

  beforeEach(() => P.join(prmq.deleteExchangesAndQueues(
    [
      'test_exchange',
      'logs',
      'direct_logs'
    ], [
      'test_queue',
      'task_queue',
      'logs',
      'hello',
    ]
  )));

  it('HelloWorld', (done) => {
    prmq.channel()
      .then(async (ch) => {
        await ch.queue('hello')
          .consume((msg) => {
            expect(msg).eq('Hello World!');
            done();
          })
          .sendAndGo('Hello World!');
      })
  });

  it('Worker', (done) => {
    prmq.channel(1)
      .then(async (ch) => {
        await ch.queue('task_queue')
          .consumeWithAck((msg, ack) => {
            console.log("INC MESSAGE")
            setTimeout(() => {
              expect(msg).to.contain('Hello World!');
              ack();
              done();
            })
          })
          .sendPersistent('Hello World!')
          .go();
      });
  });

  it('PubSub', (done) => {

    prmq.channel()
      .then(async (ch) => {
        const ex = await ch.exchangeFanout('logs').go();

        await ch.queue('')
          .bind(ex)
          .consume((msg) => {
            expect(msg).to.eq('Hello World');
            done();
          })
          .go();

        await ex.publish('Hello World').go();
      });

  });

  it('Routing', (done) => {
    const msg = 'Hello World!';
    const severity = 'info';
    prmq.channel()
      .then(async (ch) => {
        const ex = await ch.exchangeDirect('logs').go();
        await ch.queueExclusive('')
          .bindWithRoutings(ex, [
            'info',
            'warning',
            'error'
          ])
          .consumeRaw((msg) => {
            console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
            done();
          }).go();

        await ex.publishWithRoute(msg, severity).go();
      })
  });

});

