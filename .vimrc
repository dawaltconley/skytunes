set relativenumber

let g:astro_typescript = 'enable'

let g:ale_fix_on_save = 1
" let g:ale_linters_explicit = 1
let g:ale_linter_aliases['astro'] = ['html', 'css', 'scss', 'javascript', 'typescript']
let g:ale_linters['astro'] = ['eslint', 'stylelint']
let g:ale_fixers['astro'] = ['prettier']

source ~/.vim/coc.vim

call coc#config('tsserver.enable', v:true)
call coc#config('eslint.enable', v:true)
