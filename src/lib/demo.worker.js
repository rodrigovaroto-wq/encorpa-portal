// Monta os dados de exemplo fora da tela: um ano simulado passa pela conta inteira do servidor (~2 s), e no worker a tela não trava.
import { demoData } from "./demo.js";

self.onmessage = (e) => self.postMessage(demoData(e.data?.automations));
