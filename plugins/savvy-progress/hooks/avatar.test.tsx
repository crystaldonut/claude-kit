import { expect, mock, test } from 'claude-code/testing'
import type { Engine, On } from 'claude-code/testing'

const PLUGIN = 'savvy-progress'
const FILE = '/home/me/.claude/savvy-progress/avatars.json'
const pane = (bodyColumns: number) =>
  ({ title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} }) as const

// A session with an avatars file (or none), and agents spawned as [type, name].
async function session($: Engine, on: On, agents: [string, string][], file?: unknown) {
  mock.clock(on, { now: Date.parse('2026-11-19T18:00:00Z') })
  mock.env(on, { HOME: '/home/me', LANG: 'en_US.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  // No file: nothing answers, so the read fails as a missing file does.
  if (file !== undefined) {
    on('fs.stat', { path: FILE }, async () => ({ value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false } }) as never)
    on('fs.read', { path: FILE }, async () => ({ value: JSON.stringify(file) }) as never)
  }
  on('tool.register', async () => ({ value: undefined }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('agent.spawn', async e => ({ agentId: e.tool_use_id, model: 'claude-sonnet-5-5' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  for (const [i, [type, name]] of agents.entries())
    await $.agent.spawn({ subagentType: type, description: name, prompt: 'go', tool_use_id: `t${i}` } as never)
}

const mount = ($: Engine, cols = 60) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane(cols) })

test('terminal: each agent row draws a crab in its type color', async ($, on) => {
  await session($, on, [['savvy-light', 'Wire it'], ['web-fetch', 'Read docs'], ['general-purpose', 'Review']])
  const ui = await mount($)
  // Running rows are listed newest first.
  const heads = await ui.findAll({ type: 'Text', text: /▐▛███▜▌/ })
  expect(heads.map(el => el.props.color)).toEqual(['#D97757', '#2BA3A3', '#1D9E75'])
  expect(await ui.findAll({ type: 'Text', text: /^▣$/ })).toHaveLength(0)
})

test('terminal: a narrow pane keeps the square instead of the crab', async ($, on) => {
  await session($, on, [['general-purpose', 'Review']])
  const ui = await mount($, 30)
  expect(await ui.findAll({ type: 'Text', text: /▐▛███▜▌/ })).toHaveLength(0)
  expect((await ui.find({ type: 'Text', text: /^▣$/ }))?.props.color).toBe('#D97757')
})

test('an unknown agent type keeps one color', async ($, on) => {
  await session($, on, [['my-reviewer', 'One'], ['my-reviewer', 'Two']])
  const colors = (await (await mount($)).findAll({ type: 'Text', text: /▐▛███▜▌/ })).map(el => el.props.color)
  expect(colors).toHaveLength(2)
  expect(colors[0]).toBe(colors[1])
  expect(colors[0]).not.toBe('#888780')
})

test('the avatars file gives a role, matched by name, its own art, color and label', async ($, on) => {
  const file = {
    avatars: [
      { match: 'paranoid', label: 'Paranoid', color: '#D95F5F', art: ['(ಠ_ಠ)'] },
      { type: 'general-purpose', match: '^ceo', label: 'CEO', art: ['[$_$]', ' /|\\'] },
      { type: 'web-fetch', color: 'not a color', art: ['<o>'] },
      { match: '(', art: ['broken pattern'] },
    ],
  }
  await session($, on, [['general-purpose', 'Paranoid review gate'], ['general-purpose', 'CEO review, round 2'], ['web-fetch', 'Read docs'], ['general-purpose', 'Senior QA gate']], file)
  const ui = await mount($)

  expect((await ui.find({ type: 'Text', text: /\(ಠ_ಠ\)/ }))?.props.color).toBe('#D95F5F')
  expect(await ui.find({ text: /Paranoid · Sonnet 5\.5/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\[\$_\$\]/ })).toBeDefined()
  expect(await ui.find({ text: /CEO · Sonnet 5\.5/ })).toBeDefined()
  // A bad color falls back to the type's own; a rule whose pattern does not compile is dropped.
  expect((await ui.find({ type: 'Text', text: /<o>/ }))?.props.color).toBe('#2BA3A3')
  expect(await ui.findAll({ type: 'Text', text: /broken pattern/ })).toHaveLength(0)
  expect(await ui.findAll({ type: 'Text', text: /▐▛███▜▌/ })).toHaveLength(1)
})

test('emoji art is measured in cells, so the text beside it lines up', async ($, on) => {
  const file = {
    avatars: [
      { match: 'ceo', art: ['👑', '🧑‍💼', '🇺🇸'] },
      { match: 'qa', art: ['✅❤️x', 'abcd'] },
      { match: 'long', art: ['🦀🦀🦀🦀🦀🦀🦀🦀🦀'] },
    ],
  }
  await session($, on, [['general-purpose', 'CEO review'], ['general-purpose', 'QA gate'], ['general-purpose', 'Long one']], file)
  const ui = await mount($)
  const lines = (re: RegExp) => ui.findAll({ type: 'Text', text: re }).then(els => els.map(el => String(el.text)))
  // Each emoji, joined person and flag included, is one character two cells wide.
  expect(await lines(/👑|🧑‍💼|🇺🇸/)).toEqual(['👑', '🧑‍💼', '🇺🇸'])
  // ✅ is wide, and ❤ with VS16 too: 5 cells, padded to nothing next to the 4-cell line.
  expect(await lines(/✅|abcd/)).toEqual(['✅❤️x', 'abcd '])
  // Nine crabs are 18 cells: cut to 16, never through a crab.
  expect(await lines(/🦀/)).toEqual(['🦀🦀🦀🦀🦀🦀🦀🦀'])
})

test('terminal: avatars of different widths share one column', async ($, on) => {
  await session($, on, [['general-purpose', 'Plain'], ['general-purpose', 'Paranoid']], { avatars: [{ match: 'paranoid', art: ['(o)'] }] })
  const boxes = await (await mount($)).findAll({ type: 'Box' })
  expect(boxes.filter(el => el.props.flexShrink === 0).map(el => el.props.width)).toEqual([9, 9])
})
