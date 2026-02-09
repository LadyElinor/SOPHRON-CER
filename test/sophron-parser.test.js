import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SophronParser, SophronUtils } from '../lib/alignment/parsers/sophron-parser.js';

const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

describe('SophronParser', () => {
  describe('parse', () => {
    it('should parse valid SOPHRON-1 message', () => {
      const parser = new SophronParser(mockLogger);
      const message = 'ALIGN-STATUS:GREEN|PROBE:ALIGN+ITER|RED:3|STG:morse-v2|HYP:9|TECH:ALLOCATE-COMPUTE|25%|AUDIT:0x8D';
      
      const ast = parser.parse(message);
      
      assert.strictEqual(ast.header, 'ALIGN-STATUS:GREEN');
      assert.strictEqual(ast.corePredicate, 'PROBE:ALIGN+ITER');
      assert.strictEqual(ast.attributes.RED, '3');
      assert.strictEqual(ast.attributes.STG, 'morse-v2');
      assert.strictEqual(ast.attributes.HYP, '9');
    });

    it('should compute canonical form deterministically', () => {
      const parser = new SophronParser(mockLogger);
      const msg1 = 'H|P|A:1|B:2|PAYLOAD|F';
      const msg2 = 'H|P|B:2|A:1|PAYLOAD|F'; // Attributes in different order
      
      const ast1 = parser.parse(msg1);
      const ast2 = parser.parse(msg2);
      
      assert.strictEqual(ast1.canonical, ast2.canonical);
      assert.strictEqual(ast1.hash, ast2.hash);
    });

    it('should extract alignment markers', () => {
      const parser = new SophronParser(mockLogger);
      const message = 'H|P|RED:3|STG:morse-v2|HYP:9|TECH:PROBE+ITER|HUMAN:AUDIT+CONFLICT|F';
      
      const ast = parser.parse(message);
      const markers = ast.extractMarkers();
      
      assert.strictEqual(markers.red, 3);
      assert.strictEqual(markers.stg, 'morse-v2');
      assert.strictEqual(markers.hyp, 9);
      assert.deepStrictEqual(markers.tech, ['PROBE', 'ITER']);
      assert.deepStrictEqual(markers.human, ['AUDIT', 'CONFLICT']);
    });

    it('should validate redundancy claims', () => {
      const parser = new SophronParser(mockLogger);
      const message = 'H|P|RED:3|PAYLOAD|F';
      
      const ast = parser.parse(message);
      
      // Not enough sources
      assert.strictEqual(
        ast.validateRedundancy([{ src: 'a' }, { src: 'b' }]),
        false
      );
      
      // Enough sources
      assert.strictEqual(
        ast.validateRedundancy([{ src: 'a' }, { src: 'b' }, { src: 'c' }]),
        true
      );
      
      // Duplicate sources don't count
      assert.strictEqual(
        ast.validateRedundancy([{ src: 'a' }, { src: 'a' }, { src: 'a' }]),
        false
      );
    });

    it('should throw on invalid format', () => {
      const parser = new SophronParser(mockLogger);
      
      assert.throws(() => {
        parser.parse('INVALID');
      }, /Invalid SOPHRON-1 format/);
    });
  });

  describe('extractFromReceipts', () => {
    it('should extract SOPHRON messages from receipts', () => {
      const parser = new SophronParser(mockLogger);
      
      const receipts = [
        {
          id: 'r1',
          timestamp: Date.now(),
          toolCalls: [
            {
              name: 'probe',
              args: 'H|P|RED:2|PAYLOAD|F'
            }
          ]
        },
        {
          id: 'r2',
          timestamp: Date.now(),
          output: 'H|P|ATTR:val|PAYLOAD|F'
        }
      ];
      
      const messages = parser.extractFromReceipts(receipts);
      
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0].provenance.receiptId, 'r1');
      assert.strictEqual(messages[0].provenance.source, 'tool_call');
      assert.strictEqual(messages[1].provenance.receiptId, 'r2');
      assert.strictEqual(messages[1].provenance.source, 'model_output');
    });
  });

  describe('isSophronMessage', () => {
    it('should identify SOPHRON messages', () => {
      const parser = new SophronParser(mockLogger);
      
      assert.strictEqual(
        parser.isSophronMessage('H|P|RED:3|PAYLOAD|ABCD'),
        true
      );
      
      assert.strictEqual(
        parser.isSophronMessage('Just a regular string'),
        false
      );
      
      assert.strictEqual(
        parser.isSophronMessage('Has|pipes|but|no|markers'),
        false
      );
    });
  });

  describe('validateCrossMessageRedundancy', () => {
    it('should validate redundancy across messages', () => {
      const parser = new SophronParser(mockLogger);
      
      const msg = 'H|P|RED:3|PAYLOAD|F';
      const asts = [
        parser.parse(msg),
        parser.parse(msg),
        parser.parse(msg)
      ];
      
      // Same messages don't count as independent
      assert.strictEqual(
        parser.validateCrossMessageRedundancy(asts, 3),
        false
      );
    });
  });
});

describe('SophronUtils', () => {
  describe('areEquivalent', () => {
    it('should compare ASTs by hash', () => {
      const parser = new SophronParser(mockLogger);
      
      const ast1 = parser.parse('H|P|A:1|PAYLOAD|F');
      const ast2 = parser.parse('H|P|A:1|PAYLOAD|F');
      const ast3 = parser.parse('H|P|A:2|PAYLOAD|F');
      
      assert.strictEqual(SophronUtils.areEquivalent(ast1, ast2), true);
      assert.strictEqual(SophronUtils.areEquivalent(ast1, ast3), false);
    });
  });

  describe('extractDirectives', () => {
    it('should extract all directives from ASTs', () => {
      const parser = new SophronParser(mockLogger);
      
      const asts = [
        parser.parse('H|P|A|TECH:PROBE+ITER|F'),
        parser.parse('H|P|A|HUMAN:AUDIT|F'),
        parser.parse('H|P|A|TECH:PROBE|SOC:IDLE|F')
      ];
      
      const directives = SophronUtils.extractDirectives(asts);
      
      assert.deepStrictEqual(directives.tech, ['PROBE', 'ITER']);
      assert.deepStrictEqual(directives.human, ['AUDIT']);
      assert.deepStrictEqual(directives.soc, ['IDLE']);
    });
  });

  describe('groupByHash', () => {
    it('should group messages by hash', () => {
      const parser = new SophronParser(mockLogger);
      
      const ast1 = parser.parse('H|P|A:1|PAYLOAD|F');
      const ast2 = parser.parse('H|P|A:1|PAYLOAD|F');
      const ast3 = parser.parse('H|P|A:2|PAYLOAD|F');
      
      const groups = SophronUtils.groupByHash([ast1, ast2, ast3]);
      
      assert.strictEqual(groups.size, 2);
      assert.strictEqual(groups.get(ast1.hash).length, 2);
      assert.strictEqual(groups.get(ast3.hash).length, 1);
    });
  });
});
