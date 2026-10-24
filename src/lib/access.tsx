/**
 * What the signed-in person may see. Operatives never see money: rates, values, valuations,
 * invoices, costs or margins are left out of every screen they use.
 * This is a screen rule (the data on a shared company device is the company's); it keeps figures
 * away from people who don't need them, it is not an encryption boundary.
 */
import { createContext, useContext } from 'react'

export type Access = { role: string | null; money: boolean; manage: boolean }
export const accessFor = (role: string | null | undefined): Access => ({
  role: role ?? null,
  money: role !== 'operative',            // unknown role (offline first run, older cache): treat as office
  manage: role === 'owner' || role === 'director' || role == null,
})
export const AccessContext = createContext<Access>(accessFor(null))
export const useAccess = () => useContext(AccessContext)
