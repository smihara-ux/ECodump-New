import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const dir=mkdtempSync(join(tmpdir(),"ecodump-ui-flow-"));
const env={...process.env,ECODUMP_API_PORT:"4190",ECODUMP_DB_PATH:join(dir,"flow.sqlite"),WORKFLOW_API_PROXY_TARGET:"http://127.0.0.1:4190"};
const api=spawn(process.execPath,["server/start-workflow-api.mjs"],{cwd:process.cwd(),env,stdio:"inherit"});
const vite=spawn("npm",["run","dev","--","--host","127.0.0.1","--port","4191","--strictPort"],{cwd:process.cwd(),env,stdio:"inherit"});
const stop=()=>{api.kill("SIGTERM");vite.kill("SIGTERM");rmSync(dir,{recursive:true,force:true})};
const wait=async(url)=>{for(let i=0;i<50;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error(`${url} did not start`)};
let browser;
try{
  await wait("http://127.0.0.1:4191"); browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1280,height:800}});
  const panel=page.locator(".direct-workflow");
  await page.goto("http://127.0.0.1:4191/?preview=app&role=construction&page=transport"); await panel.getByRole("button",{name:/搬出予定・搬入予約/}).click(); await panel.getByText("予約確認待ち").waitFor();
  await page.goto("http://127.0.0.1:4191/?preview=app&role=receiving&page=receiving-reservations"); await panel.getByRole("button",{name:/予約を確認して確定/}).click(); await panel.getByText("予約確定").waitFor();
  await page.goto("http://127.0.0.1:4191/?preview=app&role=construction&page=dispatch"); await panel.getByRole("button",{name:/車両・ドライバー/}).click(); await panel.getByText("配車済み").waitFor();
  await page.goto("http://127.0.0.1:4191/?app=driver");
  for(const name of ["到着を報告","出発を報告","荷下ろし完了を報告"]){await panel.getByRole("button",{name}).click()}
  await panel.getByText("荷下ろし完了").waitFor();
  await page.goto("http://127.0.0.1:4191/?preview=app&role=receiving&page=receiving-results"); await panel.getByRole("button",{name:/実績数量/}).click(); await panel.getByText(/受入実績確定/).waitFor();
  await page.goto("http://127.0.0.1:4191/?preview=app&role=construction&page=results"); await panel.getByText(/受入実績確定/).waitFor(); await page.reload(); await panel.getByText(/受入実績確定/).waitFor();
  console.log("workflow UI E2E: construction -> receiving -> driver -> receiving -> both results PASS");
} finally {await browser?.close();stop()}
