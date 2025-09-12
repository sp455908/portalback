const EventEmitter = require('events');

class IIFTLEventBus extends EventEmitter {}

const eventBus = new IIFTLEventBus();

module.exports = eventBus;