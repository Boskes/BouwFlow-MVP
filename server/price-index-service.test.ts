import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseI2021Workbook, parseLaborIndexText } from './price-index-service.js'

describe('officiële Belgische prijsindexbronnen',()=>{
  it('leest de samengestelde I-2021-reeks uit het officiële werkbladschema',async()=>{
    const workbook=new ExcelJS.Workbook()
    const sheet=workbook.addWorksheet('I_2021 (Nl)')
    sheet.getRow(2).getCell(4).value='jan-26'
    sheet.getRow(2).getCell(5).value='feb-26'
    sheet.getRow(33).getCell(4).value=150.26
    sheet.getRow(33).getCell(5).value={formula:'1+1',result:151.36}
    const buffer=await workbook.xlsx.writeBuffer()

    await expect(parseI2021Workbook(new Uint8Array(buffer))).resolves.toEqual([
      {series:'I-2021',period:'2026-01',value:150.26},
      {series:'I-2021',period:'2026-02',value:151.36},
    ])
  })

  it('leest S en s per werkgeversgrootte en arbeiderscategorie',()=>{
    const text=`
Waarden kleine "s" op 01/04/2026 voor de offerten neergelegd vanaf 11/06/2007 en grote "S" voor de aanbestedingen vanaf 11/04/2026.
a) voor werkgevers die minder dan 10 werklieden tewerkstellen.
s op 38,427 38,396 37,538 37,041
b) voor werkgevers die 10 tot 20 werklieden tewerkstellen.
s op 39,545 39,514 38,656 38,159
c) voor werkgevers die meer dan 20 werklieden tewerkstellen.
s op 39,539 39,508 38,650 38,153
-- 1 of 1 --`
    const values=parseLaborIndexText(text)
    expect(values).toHaveLength(12)
    expect(values).toContainEqual({series:'S',smallEffectiveDate:'2026-04-01',baseEffectiveDate:'2026-04-11',employerSize:'Meer dan 20',category:'A',value:39.539})
    expect(values).toContainEqual({series:'S',smallEffectiveDate:'2026-04-01',baseEffectiveDate:'2026-04-11',employerSize:'10 tot 20',category:'D',value:38.159})
  })
})
