const { ethers } = require("hardhat");

async function main() {
  //Update with your validators!
  let validators = [
    '0xAE89D84e95cE4B82C94F6645029D633f5c6623aa'
  ]
  let requiredAddress = ""

  const MultiSignatureGeneric = await ethers.getContractFactory("MultiSignatureGeneric");
  const multiSignatureGeneric = await MultiSignatureGeneric.deploy(validators, requiredAddress);

  await multiSignatureGeneric.deployed();

  console.log("MultiSignature deployed to:", multiSignatureGeneric.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
