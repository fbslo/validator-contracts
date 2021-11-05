const { ethers } = require("hardhat");

async function main() {
  //Update with your validators!
  let validators = [
    '0x000000000000000000000000000000000000dEaD'
  ]
  let token = '0x44883053BfCaf90af0787618173DD56e8C2dEB36'

  const MultiSignature = await ethers.getContractFactory("MultiSignature");
  const multiSignature = await MultiSignature.deploy(validators, token);

  await multiSignature.deployed();

  console.log("MultiSignature deployed to:", multiSignature.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
