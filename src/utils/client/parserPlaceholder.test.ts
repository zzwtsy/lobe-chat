import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalGeneralSelectors } from '@/store/global/selectors';

import { VARIABLE_GENERATORS, parsePlaceholderVariablesMessages } from './parserPlaceholder';

// Mock dependencies
vi.mock('@/utils/uuid', () => ({
  uuid: () => 'mocked-uuid-12345',
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: () => ({}),
  },
}));

vi.mock('@/store/user/selectors', () => ({
  userProfileSelectors: {
    displayUserName: () => 'testuser',
    nickName: () => 'Test User',
    fullName: () => 'Test Full Name',
  },
}));

vi.mock('@/store/agent/store', () => ({
  getAgentStoreState: () => ({}),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentChatConfigSelectors: {
    currentChatConfig: () => ({
      inputTemplate: 'Hello {{username}}!',
    }),
  },
}));

vi.mock('@/store/global/selectors', () => ({
  globalGeneralSelectors: {
    currentLanguage: vi.fn(),
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: {
    getState: () => ({}),
  },
}));

describe('parsePlaceholderVariablesMessages', () => {
  beforeEach(() => {
    // Mock Date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-06T06:06:06.666Z'));

    // Mock Math.random for consistent random values
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('string content messages', () => {
    it('should replace template variables in string content', () => {
      const messages = [
        {
          id: '1',
          content: 'Hello {{username}}, today is {{date}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toContain('testuser');
      expect(result[0].content).toContain(new Date().toLocaleDateString());
    });

    it('should use current language for date formatting', () => {
      // 模拟中文环境
      vi.mocked(globalGeneralSelectors.currentLanguage).mockReturnValue('zh-CN');

      const messages = [
        {
          id: '1',
          content: '今天是{{date}}，星期{{weekday}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      // 验证中文日期格式（包含年月日）
      expect(result[0].content).toMatch(/\d{4}年\d{1,2}月\d{1,2}日/);
      // 验证中文星期格式
      expect(result[0].content).toMatch(/星期[一二三四五六日]/);
    });

    it('should use English format when language is en-US', () => {
      // 模拟英语环境
      vi.mocked(globalGeneralSelectors.currentLanguage).mockReturnValue('en-US');

      const messages = [
        {
          id: '1',
          content: 'Today is {{weekday}}, {{date}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      // 验证英文日期格式（包含/分隔符）
      expect(result[0].content).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      // 验证英文星期格式
      expect(result[0].content).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
    });

    it('should handle multiple variables in one message', () => {
      const messages = [
        {
          id: '1',
          content: 'Time: {{time}}, Date: {{date}}, User: {{nickname}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toContain('Test User');
      expect(result[0].content).toMatch(/Time: .+, Date: .+, User: Test User/);
    });

    it('should preserve message structure when replacing variables', () => {
      const messages = [
        {
          id: '1',
          role: 'user',
          content: 'Hello {{username}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0]).toEqual({
        id: '1',
        role: 'user',
        content: 'Hello testuser',
      });
    });
  });

  describe('array content messages', () => {
    it('should replace variables in text type array elements', () => {
      const messages = [
        {
          id: '1',
          content: [
            {
              type: 'text',
              text: 'Hello {{username}}',
            },
            {
              type: 'image_url',
              image_url: 'image.jpg',
            },
          ],
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content[0].text).toBe('Hello testuser');
      expect(result[0].content[1]).toEqual({
        type: 'image_url',
        image_url: 'image.jpg',
      });
    });

    it('should handle multiple text elements with variables', () => {
      const messages = [
        {
          id: '1',
          content: [
            {
              type: 'text',
              text: 'Date: {{date}}',
            },
            {
              type: 'text',
              text: 'Time: {{time}}',
            },
            {
              type: 'image_url',
              image_url: 'test.jpg',
            },
          ],
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content[0].text).toContain(new Date().toLocaleDateString());
      expect(result[0].content[1].text).toContain(new Date().toLocaleTimeString());
      expect(result[0].content[2]).toEqual({
        type: 'image_url',
        image_url: 'test.jpg',
      });
    });

    it('should preserve non-text array elements unchanged', () => {
      const messages = [
        {
          id: '1',
          content: [
            {
              type: 'image_url',
              image_url: 'image.jpg',
            },
            {
              type: 'image_url',
              name: 'image2.jpg',
            },
          ],
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toEqual([
        {
          type: 'image_url',
          image_url: 'image.jpg',
        },
        {
          type: 'image_url',
          name: 'image2.jpg',
        },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages array', () => {
      const result = parsePlaceholderVariablesMessages([]);
      expect(result).toEqual([]);
    });

    it('should handle messages without content', () => {
      const messages = [{ id: '1' }, { id: '2', content: null }, { id: '3', content: undefined }];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result).toEqual([
        { id: '1' },
        { id: '2', content: null },
        { id: '3', content: undefined },
      ]);
    });

    it('should handle empty string content', () => {
      const messages = [{ id: '1', content: '' }];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toBe('');
    });

    it('should handle content without variables', () => {
      const messages = [
        { id: '1', content: 'Hello world!' },
        {
          id: '2',
          content: [
            { type: 'text', text: 'No variables here' },
            { type: 'image_url', image_url: 'test.jpg' },
          ],
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toBe('Hello world!');
      expect(result[1].content[0].text).toBe('No variables here');
    });

    it('should handle unknown variable types', () => {
      const messages = [{ id: '1', content: 'Hello {{unknown_variable}}!' }];

      const result = parsePlaceholderVariablesMessages(messages);

      // Unknown variables should remain unchanged
      expect(result[0].content).toBe('Hello {{unknown_variable}}!');
    });

    it('should handle nested variables (input_template)', () => {
      const messages = [{ id: '1', content: 'Template: {{input_template}}' }];

      const result = parsePlaceholderVariablesMessages(messages);

      // Should resolve nested variables in input_template
      expect(result[0].content).toBe('Template: Hello testuser!');
    });
  });

  describe('specific variable types', () => {
    it('should handle time variables', () => {
      const messages = [
        {
          id: '1',
          content: 'Year: {{year}}, Month: {{month}}, Day: {{day}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toContain('Year: 2025');
      expect(result[0].content).toContain('Month: 06');
      expect(result[0].content).toContain('Day: 06');
    });

    it('should handle random variables', () => {
      const messages = [
        {
          id: '1',
          content: 'Random: {{random}}, Bool: {{random_bool}}, UUID: {{uuid}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toContain('Random: 500001'); // Math.random() * 1000000 + 1 with 0.5
      expect(result[0].content).toContain('Bool: false'); // Math.random() > 0.5 with 0.5
      expect(result[0].content).toContain('UUID: mocked-uuid-12345');
    });

    it('should handle user variables', () => {
      const messages = [
        {
          id: '1',
          content: 'User: {{username}}, Nickname: {{nickname}}',
        },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toBe('User: testuser, Nickname: Test User');
    });

    it('should handle language change dynamically', () => {
      // 初始设置为中文
      vi.mocked(globalGeneralSelectors.currentLanguage).mockReturnValue('zh-CN');
      const messagesCN = [
        {
          id: '1',
          content: '{{date}}',
        },
        {
          id: '2',
          content: '{{weekday}}',
        },
        {
          id: '3',
          content: '{{time}}',
        },
        {
          id: '4',
          content: '{{datetime}}',
        },
      ];
      const resultCN = parsePlaceholderVariablesMessages(messagesCN);
      const cnDate = resultCN[0].content;
      const cnWeekday = resultCN[1].content;
      const cnTime = resultCN[2].content;
      const cnDatetime = resultCN[3].content;

      // 切换为英文
      vi.mocked(globalGeneralSelectors.currentLanguage).mockReturnValue('en-US');
      const messagesEN = [
        {
          id: '1',
          content: '{{date}}',
        },
        {
          id: '2',
          content: '{{weekday}}',
        },
        {
          id: '3',
          content: '{{time}}',
        },
        {
          id: '4',
          content: '{{datetime}}',
        },
      ];
      const resultEN = parsePlaceholderVariablesMessages(messagesEN);
      const enDate = resultEN[0].content;
      const enWeekday = resultEN[1].content;
      const enTime = resultEN[2].content;
      const enDatetime = resultEN[3].content;

      // 验证不同语言下的日期格式不同
      expect(cnDate).not.toEqual(enDate);
      expect(cnDate).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
      expect(enDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(cnWeekday).not.toEqual(enWeekday);
      expect(cnWeekday).toMatch(/星期[一二三四五六日]/);
      expect(enWeekday).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
      expect(cnTime).not.toEqual(enTime);
      expect(cnTime).toMatch(/\d{1,2}:\d{2}:\d{2}/);
      expect(enTime).toMatch(/\d{1,2}:\d{2}:\d{2} (AM|PM)/);
      expect(cnDatetime).not.toEqual(enDatetime);
      expect(cnDatetime).toMatch(/\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}/);
      expect(enDatetime).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)/);
    });
  });

  describe('multiple messages', () => {
    it('should process multiple messages correctly', () => {
      const messages = [
        { id: '1', content: 'Hello {{username}}' },
        {
          id: '2',
          content: [{ type: 'text', text: 'Today is {{date}}' }],
        },
        { id: '3', content: 'Time: {{time}}' },
      ];

      const result = parsePlaceholderVariablesMessages(messages);

      expect(result[0].content).toBe('Hello testuser');
      expect(result[1].content[0].text).toContain(new Date().toLocaleDateString());
      expect(result[2].content).toContain(new Date().toLocaleTimeString());
    });
  });
});
