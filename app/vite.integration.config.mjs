import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config.mjs';
export default mergeConfig(base,defineConfig({server:{host:'127.0.0.1',port:5202,strictPort:true,proxy:{'/api/direct':{target:'http://127.0.0.1:6102',changeOrigin:true}}}}));
