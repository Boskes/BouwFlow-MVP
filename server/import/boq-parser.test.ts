import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { parseBoqFile } from './boq-parser.js'

describe('meetstaatimport', () => {
  it('leest een Belgische puntkomma-CSV met getypte getallen', async () => {
    const csv = [
      'Hoofdstuk;Hoofdstuknaam;Code;Omschrijving;Hoeveelheid;Eenheid;Arbeid;Materiaal;Materieel;Onderaanneming',
      '01;Grondwerken;01.01;Uitgraving;1.234,5;m3;2,5;4;1,25;0',
      '02;Riolering;02.01;PVC leiding;80;m;3;12,75;2;4',
    ].join('\n')

    const preview = await parseBoqFile(Buffer.from(csv, 'utf8'), 'meetstaat.csv')

    expect(preview.errors).toEqual([])
    expect(preview.chapterCount).toBe(2)
    expect(preview.rows[0]).toMatchObject({ chapterCode: '01', code: '01.01', quantity: 1234.5, labor: 2.5, equipment: 1.25 })
  })

  it('leest het eerste werkblad van een xlsx-bestand', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Meetstaat')
    sheet.addRow(['Hoofdstuk', 'Hoofdstuknaam', 'Code', 'Omschrijving', 'Hoeveelheid', 'Eenheid', 'Arbeid', 'Materiaal', 'Materieel', 'Onderaanneming'])
    sheet.addRow(['03', 'Verhardingen', '03.01', 'Asfalt', 250, 'm2', 1.5, 22, 3.5, 0])
    const bytes = await workbook.xlsx.writeBuffer()

    const preview = await parseBoqFile(Buffer.from(bytes), 'meetstaat.xlsx')

    expect(preview.sheetName).toBe('Meetstaat')
    expect(preview.validRowCount).toBe(1)
    expect(preview.rows[0]).toMatchObject({ description: 'Asfalt', material: 22 })
  })

  it('rapporteert ontbrekende verplichte velden met rijnummers', async () => {
    const csv = ['Code,Omschrijving,Hoeveelheid,Eenheid', '01.01,,10,m2', '01.02,Geldige post,-2,m2'].join('\n')

    const preview = await parseBoqFile(Buffer.from(csv), 'fouten.csv')

    expect(preview.validRowCount).toBe(0)
    expect(preview.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, field: 'description' }),
      expect.objectContaining({ row: 3, field: 'quantity' }),
    ]))
  })
})
