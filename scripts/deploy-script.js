const { ethers } = require("hardhat");

async function main() {
  //Update with your validators!
  let validators = [
    '0x000000000000000000000000000000000000dEaD'
  ]
  let token = '0x1633b7157e7638c4d6593436111bf125ee74703f'

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
