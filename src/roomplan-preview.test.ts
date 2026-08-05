import {describe,expect,it} from 'vitest'
import {parseRoomPlanPreview} from './roomplan-preview'

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]

describe('RoomPlan preview parser',()=>{
  it('converts Apple CapturedRoom JSON collections into preview elements',()=>{
    const result=parseRoomPlanPreview({
      walls:[{identifier:'wall-1',dimensions:[4.2,2.6,0],transform:identity}],
      floors:[{identifier:'floor-1',dimensions:[4.2,5.1,0],transform:identity}],
      doors:[{identifier:'door-1',dimensions:[.9,2.1,0],transform:identity}],
      windows:[{identifier:'window-1',dimensions:[1.4,1.2,0],transform:identity}],
      objects:[{identifier:'object-1',category:{storage:{}},dimensions:[1.2,.8,.5],transform:{columns:[identity.slice(0,4),identity.slice(4,8),identity.slice(8,12),identity.slice(12)]}}],
    })

    expect(result.elements.map(item=>item.kind)).toEqual(['wall','floor','door','window','object'])
    expect(result.elements[4]).toMatchObject({id:'object-1',label:'storage',dimensions:[1.2,.8,.5]})
    expect(result.counts).toEqual({wall:1,floor:1,door:1,window:1,object:1})
  })

  it('supports vector objects and a nested capturedRoom root',()=>{
    const result=parseRoomPlanPreview({capturedRoom:{walls:[{dimensions:{x:3,y:2.5,z:0},transform:identity}]}})
    expect(result.elements[0].dimensions).toEqual([3,2.5,0])
  })

  it('rejects files that cannot produce visible geometry',()=>{
    expect(()=>parseRoomPlanPreview({walls:[{dimensions:[3,2,0]}]})).toThrow(/geen tekenbare/i)
  })
})
