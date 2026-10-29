const support=document.querySelector('[data-coffee-support]');
if(support){
 const button=support.querySelector('.coffee-button'),panel=support.querySelector('.coffee-popover');
 let pinned=false,timer;
 const show=()=>{clearTimeout(timer);panel.hidden=false;button.setAttribute('aria-expanded','true');};
 const hide=()=>{clearTimeout(timer);pinned=false;panel.hidden=true;button.setAttribute('aria-expanded','false');};
 const hideLater=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!pinned&&!support.matches(':hover')&&!support.contains(document.activeElement))hide();},140);};
 support.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')show();});
 support.addEventListener('pointerleave',hideLater);
 support.addEventListener('focusin',show);
 support.addEventListener('focusout',hideLater);
 button.addEventListener('click',()=>{if(pinned)hide();else{pinned=true;show();}});
 panel.querySelector('.coffee-close').addEventListener('click',hide);
 document.addEventListener('pointerdown',event=>{if(!support.contains(event.target))hide();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){button.focus();hide();}});
}
