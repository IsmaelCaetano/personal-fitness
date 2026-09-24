export function validateNewPassword(password:string,confirmation:string):string|null{
 if(password.length<8)return 'Use ao menos 8 caracteres.';
 if(password!==confirmation)return 'As senhas não coincidem.';
 return null;
}
