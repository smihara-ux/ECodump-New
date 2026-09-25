import {test,expect} from '@playwright/test';
test('旧SQLiteパネルは再取得失敗を保存・再取得成功と表示しない',async({page})=>{
 let gets=0;
 await page.route('**/api/workflow',route=>{gets++;return route.fulfill({status:gets===1?200:503,contentType:'application/json',body:gets===1?JSON.stringify({data:[]}):JSON.stringify({message:'検証用の再取得障害'})})});
 await page.route('**/api/reservations',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({reservation:{id:'test-record'}})}));
 await page.goto('/?preview=app&role=construction&page=transport&workflowApi=1');const panel=page.locator('.direct-workflow');await expect(panel).toContainText('共通PostgreSQLとは別データ');await panel.getByRole('button',{name:'搬出予定・搬入予約をDBへ登録'}).click();await expect(panel.getByRole('alert')).toContainText('検証用の再取得障害');await expect(panel.getByText('DB保存後の再取得を確認しました。',{exact:true})).toHaveCount(0);
});
