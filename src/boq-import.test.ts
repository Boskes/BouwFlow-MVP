import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { parseBoqFileLocally } from './boq-import'

describe('lokale meetstaatimport', () => {
  it('leest een puntkomma-CSV met Belgische getalnotatie', async () => {
    const csv = 'hoofdstuk;hoofdstuknaam;code;omschrijving;hoeveelheid;eenheid;arbeid;materiaal;materieel;onderaanneming\r\n01;Grondwerken;01.01;Uitgraven;1.234,50;m³;2,50;0;3,75;0\r\n'
    const preview = await parseBoqFileLocally(new File([csv], 'meetstaat.csv', { type: 'text/csv' }))

    expect(preview.errors).toEqual([])
    expect(preview.chapterCount).toBe(1)
    expect(preview.rows[0]).toMatchObject({ chapterCode: '01', code: '01.01', quantity: 1234.5, labor: 2.5, equipment: 3.75 })
  })

  it('ondersteunt komma-CSV en geciteerde omschrijvingen', async () => {
    const csv = 'code,omschrijving,hoeveelheid,eenheid\nA.01,"Beton, gewapend",25,m³\n'
    const preview = await parseBoqFileLocally(new File([csv], 'posten.csv', { type: 'text/csv' }))

    expect(preview.errors).toEqual([])
    expect(preview.rows[0]).toMatchObject({ chapterCode: '00', chapterName: 'Algemeen', description: 'Beton, gewapend' })
  })

  it('meldt ontbrekende verplichte kolommen zonder te importeren', async () => {
    const preview = await parseBoqFileLocally(new File(['code;omschrijving\n01;Test'], 'onvolledig.csv', { type: 'text/csv' }))

    expect(preview.validRowCount).toBe(0)
    expect(preview.errors.map(error => error.field)).toEqual(['quantity', 'unit'])
  })

  it('leest het eerste werkblad van een Excel-bestand', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Meetstaat')
    worksheet.addRow(['hoofdstuk', 'hoofdstuknaam', 'code', 'omschrijving', 'hoeveelheid', 'eenheid', 'arbeid'])
    worksheet.addRow(['05', 'Betonwerken', '05.01', 'Betonplaat', 80, 'm²', 14.25])
    const bytes = await workbook.xlsx.writeBuffer()
    const preview = await parseBoqFileLocally(new File([bytes as BlobPart], 'meetstaat.xlsx'))

    expect(preview.errors).toEqual([])
    expect(preview.sheetName).toBe('Meetstaat')
    expect(preview.rows[0]).toMatchObject({ chapterCode: '05', code: '05.01', quantity: 80, labor: 14.25 })
  })
})
