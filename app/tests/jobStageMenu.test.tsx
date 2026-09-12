// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StageMenu } from '../src/components/JobList'

afterEach(cleanup)

it('displays Follow Up but excludes it from dropdown options and allows moving back to Applied', () => {
  const onChange = vi.fn()
  render(<StageMenu status="needs_update" onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Follow Up' }))
  expect(screen.queryByRole('menuitemradio', { name: 'Follow Up' })).toBeNull()
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(5)
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Viewed' }))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Ghosted' }))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Viewed' }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Applied' }))
  expect(onChange).toHaveBeenCalledWith('applied')
  expect(screen.queryByRole('menu')).toBeNull()
})
